#!/usr/bin/env node
/**
 * Probe Qloo tag search + insights to mark real signals.
 * Reads QLOO_API_KEY from process.env only. Never logs the key.
 *
 * Usage: QLOO_API_KEY must already be in the environment.
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "https://hackathon.api.qloo.com";
const CITY = "Medellín";
const PAUSE_MS = 300;
const TIMEOUT_MS = 8_000;
const TAKE_TAGS = 3;
const TAKE_PLACES = 10;
const MIN_NAME_DIFF = 3;
const HOTEL_TAG_PREFIXES = ["urn:tag:genre:place:hotel", "urn:tag:category:place:hotel"];

const QUERIES = {
  music: [
    "salsa",
    "reggaeton",
    "rock",
    "jazz",
    "electronic",
    "hip hop",
    "indie",
    "pop",
    "vallenato",
    "cumbia",
    "techno",
    "latin",
    "classical",
    "reggae",
  ],
  food: [
    "japanese",
    "sushi",
    "vegan",
    "vegetarian",
    "street food",
    "coffee",
    "craft beer",
    "cocktails",
    "wine",
    "bakery",
    "italian",
    "mexican",
    "colombian",
    "seafood",
    "brunch",
    "desserts",
  ],
  entertainment: [
    "nightlife",
    "live music",
    "museums",
    "art galleries",
    "theater",
    "comedy",
    "karaoke",
    "cinema",
    "bookstores",
    "dance club",
  ],
  activities: [
    "yoga",
    "markets",
    "rooftop",
    "coworking",
    "parks",
    "bike",
    "spa",
    "shopping",
    "tours",
    "wellness",
  ],
};

const apiKey = process.env.QLOO_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing QLOO_API_KEY in the environment. Export it in this shell and run again.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function qlooGet(pathWithQuery, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HOST}${pathWithQuery}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (attempt === 0) {
      await sleep(PAUSE_MS);
      return qlooGet(pathWithQuery, 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function tagsPath(query) {
  const params = new URLSearchParams();
  params.set("filter.query", query);
  params.set("take", String(TAKE_TAGS));
  return `/v2/tags?${params.toString()}`;
}

function insightsPath(tagId) {
  const params = new URLSearchParams();
  params.set("filter.type", "urn:entity:place");
  params.set("filter.location.query", CITY);
  params.set("take", String(TAKE_PLACES));
  if (tagId) params.set("signal.interests.tags", tagId);
  return `/v2/insights?${params.toString()}`;
}

function normalizeTagsPayload(payload) {
  if (!isRecord(payload) || payload.success !== true) return [];
  const results = payload.results;
  if (!isRecord(results) || !Array.isArray(results.tags)) return [];
  const tags = [];
  for (const item of results.tags) {
    if (!isRecord(item)) continue;
    const id = asNonEmptyString(item.id) ?? asNonEmptyString(item.tag_id);
    const name = asNonEmptyString(item.name);
    const type =
      asNonEmptyString(item.type) ??
      (Array.isArray(item.types) ? asNonEmptyString(item.types[0]) : undefined) ??
      "";
    if (id && name) tags.push({ id, name, type });
  }
  return tags;
}

function normalizePlacesPayload(payload) {
  if (!isRecord(payload) || payload.success !== true) return [];
  const results = payload.results;
  if (!isRecord(results) || !Array.isArray(results.entities)) return [];
  const places = [];
  for (const raw of results.entities) {
    if (!isRecord(raw)) continue;
    const name = asNonEmptyString(raw.name);
    if (!name) continue;
    const tags = [];
    if (Array.isArray(raw.tags)) {
      for (const item of raw.tags) {
        if (!isRecord(item)) continue;
        const id = asNonEmptyString(item.id) ?? asNonEmptyString(item.tag_id);
        if (id) tags.push({ id });
      }
    }
    places.push({ name, tags });
  }
  return places;
}

function isPlaceOrGenre(tag) {
  const blob = `${tag.type} ${tag.id}`.toLowerCase();
  return blob.includes("place") || blob.includes("genre");
}

function pickTag(tags) {
  return tags.find(isPlaceOrGenre) ?? null;
}

function isHotel(place) {
  if (/\bhotel\b/i.test(place.name)) return true;
  return place.tags.some((tag) =>
    HOTEL_TAG_PREFIXES.some((prefix) => tag.id.startsWith(prefix))
  );
}

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeNames(places) {
  return places.filter((place) => !isHotel(place)).slice(0, TAKE_PLACES).map((place) => place.name);
}

function differsFromBaseline(names, baselineSet) {
  let different = 0;
  for (const name of names.slice(0, TAKE_PLACES)) {
    if (!baselineSet.has(normalizeName(name))) different += 1;
  }
  return different >= MIN_NAME_DIFF;
}

function isDefaultParkList(names) {
  if (names.length === 0) return false;
  const parkish = names.filter((name) =>
    /parque|\bpark\b|jardin botanico|jard[ií]n bot[aá]nico|\bcerro\b/i.test(name)
  );
  return parkish.length >= 5;
}

async function fetchPlaces(tagId) {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(insightsPath(tagId));
  return placeNames(normalizePlacesPayload(payload));
}

async function fetchTag(query) {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(tagsPath(query));
  return pickTag(normalizeTagsPayload(payload));
}

function pad(value, width) {
  return String(value ?? "").padEnd(width);
}

async function main() {
  console.error("Fetching Medellín baseline (no signal)…");
  let baselineNames;
  try {
    await sleep(PAUSE_MS);
    baselineNames = placeNames(normalizePlacesPayload(await qlooGet(insightsPath(""))));
  } catch {
    console.error("Baseline insights request failed. No tags were verified.");
    process.exit(1);
  }

  const baselineSet = new Set(baselineNames.map(normalizeName));
  const rows = [];

  for (const [category, queries] of Object.entries(QUERIES)) {
    for (const query of queries) {
      let tagId = "";
      let label = query;
      let verified = false;
      let status = "NOT_VERIFIED";

      try {
        const tag = await fetchTag(query);
        if (tag) {
          tagId = tag.id;
          label = tag.name;
          const names = await fetchPlaces(tag.id);
          if (differsFromBaseline(names, baselineSet) && !isDefaultParkList(names)) {
            verified = true;
            status = "VERIFIED";
          }
        }
      } catch {
        verified = false;
        status = "NOT_VERIFIED";
      }

      rows.push({ category, query, tagId, label, verified });
      console.log(`${pad(category, 15)} ${pad(query, 16)} ${pad(tagId || "—", 52)} ${status}`);
    }
  }

  const outPath = join(dirname(fileURLToPath(import.meta.url)), "verified-tags.out.json");
  await writeFile(outPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.error(`Wrote ${rows.length} rows to scripts/verified-tags.out.json`);
}

await main();
