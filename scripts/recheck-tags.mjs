#!/usr/bin/env node
/**
 * Re-check previously collected Qloo tag IDs against dynamic filler lists.
 * Reads QLOO_API_KEY from process.env only. Never logs the key.
 *
 * Usage: QLOO_API_KEY must already be in the environment.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "https://hackathon.api.qloo.com";
const CITY = "Medellín";
const PAUSE_MS = 300;
const TIMEOUT_MS = 8_000;
const TAKE_PLACES = 10;
const FALLBACK_OVERLAP = 6;
const INVALID_TAG = "urn:tag:genre:place:zz_invalid_tag";
const HOTEL_TAG_PREFIXES = ["urn:tag:genre:place:hotel", "urn:tag:category:place:hotel"];

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

function insightsPath(tagId) {
  const params = new URLSearchParams();
  params.set("filter.type", "urn:entity:place");
  params.set("filter.location.query", CITY);
  params.set("take", String(TAKE_PLACES));
  if (tagId) params.set("signal.interests.tags", tagId);
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

function nameSet(names) {
  return new Set(names.map(normalizeName));
}

function overlapCount(names, fillerSet) {
  let count = 0;
  for (const name of names.slice(0, TAKE_PLACES)) {
    if (fillerSet.has(normalizeName(name))) count += 1;
  }
  return count;
}

function isFallback(names, baselineSet, invalidSet) {
  return (
    overlapCount(names, baselineSet) >= FALLBACK_OVERLAP ||
    overlapCount(names, invalidSet) >= FALLBACK_OVERLAP
  );
}

async function fetchPlaces(tagId) {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(insightsPath(tagId));
  return placeNames(normalizePlacesPayload(payload));
}

async function readJson(filename) {
  const path = join(scriptsDir, filename);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    console.error(`Could not read ${filename}. Run the earlier probe first.`);
    process.exit(1);
  }
}

function addTag(byId, likes, id, label, like) {
  likes.add(like);
  const existing = byId.get(id) ?? { id, label: label || id, likes: new Set() };
  if (label) existing.label = label;
  existing.likes.add(like);
  byId.set(id, existing);
}

function collectTags(verifiedRows, fixRows) {
  const byId = new Map();
  const likes = new Set();

  if (Array.isArray(verifiedRows)) {
    for (const row of verifiedRows) {
      if (!isRecord(row)) continue;
      const like = asNonEmptyString(row.query);
      if (like) likes.add(like);
      const id = asNonEmptyString(row.tagId);
      if (like && id) addTag(byId, likes, id, asNonEmptyString(row.label) ?? like, like);
    }
  }

  if (Array.isArray(fixRows)) {
    for (const row of fixRows) {
      if (!isRecord(row)) continue;
      const like = asNonEmptyString(row.like);
      if (like) likes.add(like);
      const candidates = Array.isArray(row.verified) ? row.verified : [];
      for (const item of candidates) {
        if (!isRecord(item)) continue;
        const id = asNonEmptyString(item.id);
        if (like && id) addTag(byId, likes, id, asNonEmptyString(item.label) ?? like, like);
      }
    }
  }

  return { byId, likes: [...likes] };
}

async function main() {
  const verifiedRows = await readJson("verified-tags.out.json");
  const fixRows = await readJson("fix-tags.out.json");
  const { byId, likes } = collectTags(verifiedRows, fixRows);
  if (byId.size === 0) {
    console.error("No tag ids found in the probe outputs.");
    process.exit(1);
  }

  console.error("Fetching Medellín filler lists…");
  let baselineNames;
  let invalidNames;
  try {
    await sleep(PAUSE_MS);
    baselineNames = placeNames(normalizePlacesPayload(await qlooGet(insightsPath(""))));
    invalidNames = await fetchPlaces(INVALID_TAG);
  } catch {
    console.error("Filler insights request failed. No tags were rechecked.");
    process.exit(1);
  }

  const baselineSet = nameSet(baselineNames);
  const invalidSet = nameSet(invalidNames);
  const realByLike = new Map(likes.map((like) => [like, []]));
  const fallback = [];

  for (const tag of byId.values()) {
    let names = [];
    let status = "FALLBACK";
    try {
      names = await fetchPlaces(tag.id);
      if (names.length > 0 && !isFallback(names, baselineSet, invalidSet)) status = "REAL";
    } catch {
      status = "FALLBACK";
    }

    const entry = {
      id: tag.id,
      label: tag.label,
      places: names.slice(0, 3),
      likes: [...tag.likes],
    };

    if (status === "REAL") {
      for (const like of tag.likes) {
        realByLike.get(like)?.push(entry);
      }
    } else {
      fallback.push(entry);
    }
  }

  const real = [];
  const likesWithoutReal = [];

  for (const like of likes) {
    const tags = realByLike.get(like) ?? [];
    if (tags.length === 0) {
      likesWithoutReal.push(like);
      continue;
    }
    console.log(`\n${like}`);
    for (const tag of tags) {
      real.push({ like, id: tag.id, label: tag.label, places: tag.places });
      console.log(`  REAL  ${tag.id}`);
      console.log(`        ${tag.label}`);
      console.log(`        ${tag.places.join(" · ") || "—"}`);
    }
  }

  console.log("\nGustos sin tag REAL:");
  if (likesWithoutReal.length === 0) {
    console.log("  (none)");
  } else {
    for (const like of likesWithoutReal) console.log(`  ${like}`);
  }

  const outPath = join(scriptsDir, "recheck-tags.out.json");
  await writeFile(
    outPath,
    `${JSON.stringify({ real, fallback, likesWithoutReal }, null, 2)}\n`,
    "utf8"
  );
  console.error(`Wrote ${real.length} REAL rows to scripts/recheck-tags.out.json`);
}

await main();
