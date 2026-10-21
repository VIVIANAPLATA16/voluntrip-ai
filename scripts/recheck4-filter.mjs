#!/usr/bin/env node
/**
 * Probe leftover likes with filter.tags across three cities.
 * Reads QLOO_API_KEY from process.env only. Never logs the key.
 *
 * Usage: QLOO_API_KEY must already be in the environment.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "https://hackathon.api.qloo.com";
const PAUSE_MS = 300;
const TIMEOUT_MS = 8_000;
const TAKE_PLACES = 10;
const MIN_PLACES = 3;
const CITIES = ["Medellín", "Bogotá", "Ciudad de México"];
const HOTEL_TAG_PREFIXES = ["urn:tag:genre:place:hotel", "urn:tag:category:place:hotel"];

const DIRECT_IDS = {
  cocktails: [
    "urn:tag:offerings:place:cocktails",
    "urn:tag:genre:place:restaurant:cocktail_bar",
    "urn:tag:genre:place:cocktail_bar",
  ],
  theater: [
    "urn:tag:genre:place:theater",
    "urn:tag:offerings:place:theater",
    "urn:tag:genre:place:performing_arts_theater",
  ],
  cinema: ["urn:tag:genre:place:movie_theater", "urn:tag:genre:place:cinema"],
  yoga: ["urn:tag:genre:place:yoga_studio", "urn:tag:genre:place:pilates_studio"],
  coworking: [
    "urn:tag:genre:place:coworking_space",
    "urn:tag:category:place:coworking_space",
  ],
  rooftop: [
    "urn:tag:amenity:place:rooftop_terrace",
    "urn:tag:amenity:qloo:rooftop_terrace",
  ],
  spa: ["urn:tag:genre:place:spa", "urn:tag:amenity:qloo:spa"],
  "dance club": [
    "urn:tag:genre:place:dance_club",
    "urn:tag:genre:place:night_club",
    "urn:tag:genre:place:nightclub",
    "urn:tag:genre:place:salsa_club",
  ],
  classical: [
    "urn:tag:genre:place:concert_hall",
    "urn:tag:genre:place:performing_arts_theater",
    "urn:tag:genre:place:opera_house",
    "urn:tag:genre:place:symphony_hall",
  ],
  latin: [
    "urn:tag:genre:place:restaurant:latin_american",
    "urn:tag:genre:place:salsa_club",
    "urn:tag:genre:place:dance_hall",
  ],
};

const LIKES = Object.keys(DIRECT_IDS);

const apiKey = process.env.QLOO_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing QLOO_API_KEY in the environment. Export it in this shell and run again.");
  process.exit(1);
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));

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

function yesNo(value) {
  return value ? "sí" : "no";
}

function pad(value, width) {
  return String(value ?? "").padEnd(width);
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

function insightsPath(city, tagId) {
  const params = new URLSearchParams();
  params.set("filter.type", "urn:entity:place");
  params.set("filter.location.query", city);
  params.set("filter.tags", tagId);
  params.set("take", String(TAKE_PLACES));
  return `/v2/insights?${params.toString()}`;
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

function isHotelId(id) {
  const lower = id.toLowerCase();
  return HOTEL_TAG_PREFIXES.some((prefix) => lower.startsWith(prefix)) || lower.includes(":hotel");
}

function isHotel(place) {
  if (/\bhotel\b/i.test(place.name)) return true;
  return place.tags.some((tag) => isHotelId(tag.id));
}

function withoutHotels(places) {
  return places.filter((place) => !isHotel(place)).slice(0, TAKE_PLACES);
}

async function fetchFiltered(city, tagId) {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(insightsPath(city, tagId));
  return withoutHotels(normalizePlacesPayload(payload));
}

async function readProbe(filename) {
  try {
    return JSON.parse(await readFile(join(scriptsDir, filename), "utf8"));
  } catch {
    console.error(`Could not read ${filename}. Run that probe first.`);
    process.exit(1);
  }
}

function collectIdsFromProbe(payload, like) {
  const ids = new Set();
  const rows = Array.isArray(payload?.likes) ? payload.likes : [];
  for (const row of rows) {
    if (!isRecord(row) || row.like !== like) continue;
    const candidates = Array.isArray(row.candidates) ? row.candidates : [];
    for (const item of candidates) {
      if (!isRecord(item)) continue;
      const id = asNonEmptyString(item.id);
      if (id && !isHotelId(id)) ids.add(id);
    }
  }
  return ids;
}

function collectIds(like, recheck2, recheck3) {
  const ids = new Set([
    ...collectIdsFromProbe(recheck2, like),
    ...collectIdsFromProbe(recheck3, like),
    ...(DIRECT_IDS[like] ?? []),
  ]);
  return [...ids];
}

function pickBest(idRows) {
  const byId = new Map();
  for (const row of idRows) {
    const current = byId.get(row.id) ?? { id: row.id, okCities: 0 };
    if (row.filterOk) current.okCities += 1;
    byId.set(row.id, current);
  }
  let best = null;
  for (const entry of byId.values()) {
    if (!best || entry.okCities > best.okCities) best = entry;
  }
  return best && best.okCities > 0 ? best.id : "none";
}

async function main() {
  const recheck2 = await readProbe("recheck2-tags.out.json");
  const recheck3 = await readProbe("recheck3-tags.out.json");
  const likes = [];

  for (const like of LIKES) {
    const ids = collectIds(like, recheck2, recheck3);
    console.log(`\n${like}`);
    const rows = [];

    for (const id of ids) {
      for (const city of CITIES) {
        let places = [];
        try {
          places = await fetchFiltered(city, id);
        } catch {
          places = [];
        }
        const total = places.length;
        const tagHits = places.filter((place) => place.tags.some((tag) => tag.id === id)).length;
        const filterOk = total >= MIN_PLACES && tagHits === total;
        const topPlaces = places.slice(0, 3).map((place) => place.name);
        rows.push({ id, city, total, tagHits, filterOk, places: topPlaces });
        console.log(
          `  ${pad(id, 52)} ${pad(city, 16)} total=${String(total).padStart(2)}  tagHits=${String(tagHits).padStart(2)}  FILTER_OK ${yesNo(filterOk)}  ${topPlaces.join(" · ") || "—"}`
        );
      }
    }

    if (rows.length === 0) console.log("  (none)");
    const bestId = pickBest(rows);
    console.log(`  mejor: ${bestId}`);
    likes.push({ like, bestId, rows });
  }

  const outPath = join(scriptsDir, "recheck4-filter.out.json");
  await writeFile(outPath, `${JSON.stringify({ likes }, null, 2)}\n`, "utf8");
  console.error(`Wrote ${likes.length} likes to scripts/recheck4-filter.out.json`);
}

await main();
