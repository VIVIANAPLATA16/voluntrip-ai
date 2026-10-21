#!/usr/bin/env node
/**
 * Probe leftover likes with signal vs filter.tags.
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
const TAKE_TAGS = 30;
const TAKE_PLACES = 10;
const FALLBACK_OVERLAP = 8;
const MIN_TAG_HITS_A = 4;
const MIN_PLACES_B = 3;
const INVALID_TAG = "urn:tag:genre:place:zz_invalid_tag";
const HOTEL_TAG_PREFIXES = ["urn:tag:genre:place:hotel", "urn:tag:category:place:hotel"];

const LIKES = {
  nightlife: ["nightlife", "vida nocturna", "bar", "club", "discoteca"],
  cocktails: ["cocktails", "cócteles", "cocktail bar"],
  classical: ["classical", "clásica", "orquesta", "ópera"],
  "street food": ["street food", "comida callejera", "food truck"],
  theater: ["theater", "teatro"],
  cinema: ["cinema", "cine", "movie theater"],
  yoga: ["yoga", "yoga studio", "pilates"],
  coworking: ["coworking", "co-working", "espacio de trabajo"],
  rooftop: ["rooftop", "terraza", "azotea"],
  spa: ["spa", "masajes"],
  "dance club": ["dance club", "discoteca", "salsoteca", "baile"],
  latin: ["latin", "latina", "salsa clubs"],
};

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

function insightsPath({ tagId, mode }) {
  const params = new URLSearchParams();
  params.set("filter.type", "urn:entity:place");
  params.set("filter.location.query", CITY);
  params.set("take", String(TAKE_PLACES));
  if (mode === "signal" && tagId) params.set("signal.interests.tags", tagId);
  if (mode === "filter" && tagId) params.set("filter.tags", tagId);
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
    if (id && name) tags.push({ id, label: name });
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
        const tagName = asNonEmptyString(item.name);
        if (id) tags.push({ id, name: tagName ?? id });
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

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameSet(places) {
  return new Set(places.map((place) => normalizeName(place.name)));
}

function overlapCount(places, fillerSet) {
  let count = 0;
  for (const place of places.slice(0, TAKE_PLACES)) {
    if (fillerSet.has(normalizeName(place.name))) count += 1;
  }
  return count;
}

function lastSegment(id) {
  return id.split(":").at(-1)?.replaceAll("_", " ") ?? id;
}

function placeHasTag(place, tagId, label) {
  const wanted = new Set(
    [label, lastSegment(tagId)].map(normalizeName).filter(Boolean)
  );
  return place.tags.some(
    (tag) => tag.id === tagId || wanted.has(normalizeName(tag.name))
  );
}

function tagHitCount(places, tagId, label) {
  return places.filter((place) => placeHasTag(place, tagId, label)).length;
}

function previewPlaces(places) {
  return places.slice(0, 3).map((place) => ({
    name: place.name,
    tags: place.tags.slice(0, 3).map((tag) => tag.name || tag.id),
  }));
}

async function fetchPlaces(mode, tagId = "") {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(insightsPath({ tagId, mode }));
  return withoutHotels(normalizePlacesPayload(payload));
}

async function fetchSearchTags(query) {
  await sleep(PAUSE_MS);
  return normalizeTagsPayload(await qlooGet(tagsPath(query)));
}

async function readRecheck2() {
  try {
    return JSON.parse(await readFile(join(scriptsDir, "recheck2-tags.out.json"), "utf8"));
  } catch {
    console.error("Could not read scripts/recheck2-tags.out.json. Run that probe first.");
    process.exit(1);
  }
}

function idsFromRecheck2(payload, like) {
  const byId = new Map();
  const rows = Array.isArray(payload?.likes) ? payload.likes : [];
  for (const row of rows) {
    if (!isRecord(row) || row.like !== like) continue;
    const candidates = Array.isArray(row.candidates) ? row.candidates : [];
    for (const item of candidates) {
      if (!isRecord(item)) continue;
      const id = asNonEmptyString(item.id);
      if (id && !isHotelId(id)) {
        byId.set(id, { id, label: asNonEmptyString(item.label) ?? lastSegment(id) });
      }
    }
  }
  return byId;
}

function addCandidate(byId, id, label) {
  if (!id || isHotelId(id)) return;
  const existing = byId.get(id);
  if (!existing) byId.set(id, { id, label: label || lastSegment(id) });
  else if (label && existing.label === lastSegment(existing.id)) existing.label = label;
}

async function main() {
  const recheck2 = await readRecheck2();

  console.error("Fetching Medellín filler lists…");
  let baselinePlaces;
  let invalidPlaces;
  try {
    baselinePlaces = await fetchPlaces("baseline");
    invalidPlaces = await fetchPlaces("signal", INVALID_TAG);
  } catch {
    console.error("Filler insights request failed. No tags were rechecked.");
    process.exit(1);
  }

  const baselineSet = nameSet(baselinePlaces);
  const invalidSet = nameSet(invalidPlaces);
  const likes = [];

  for (const [like, synonyms] of Object.entries(LIKES)) {
    const byId = idsFromRecheck2(recheck2, like);
    for (const query of synonyms) {
      try {
        for (const tag of await fetchSearchTags(query)) addCandidate(byId, tag.id, tag.label);
      } catch {
        continue;
      }
    }

    console.log(`\n${like}`);
    const candidates = [];
    for (const tag of byId.values()) {
      let signalPlaces = [];
      let filterPlaces = [];
      try {
        signalPlaces = await fetchPlaces("signal", tag.id);
      } catch {
        signalPlaces = [];
      }
      try {
        filterPlaces = await fetchPlaces("filter", tag.id);
      } catch {
        filterPlaces = [];
      }

      const tagHits = tagHitCount(signalPlaces, tag.id, tag.label);
      const overlapA = overlapCount(signalPlaces, baselineSet);
      const overlapB = overlapCount(signalPlaces, invalidSet);
      const realA =
        tagHits >= MIN_TAG_HITS_A ||
        (signalPlaces.length > 0 && overlapA < FALLBACK_OVERLAP && overlapB < FALLBACK_OVERLAP);
      const filterHits = tagHitCount(filterPlaces, tag.id, tag.label);
      const realB = filterPlaces.length >= MIN_PLACES_B && filterHits === filterPlaces.length;
      const places = previewPlaces(signalPlaces.length > 0 ? signalPlaces : filterPlaces);

      candidates.push({
        id: tag.id,
        label: tag.label,
        realA,
        realB,
        tagHits,
        overlapA,
        overlapB,
        filterCount: filterPlaces.length,
        filterHits,
        places,
      });

      console.log(`  ${tag.id}`);
      console.log(
        `    REAL_A ${yesNo(realA)}  REAL_B ${yesNo(realB)}  tagHits ${tagHits}/${TAKE_PLACES}`
      );
      for (const place of places) {
        console.log(`    ${place.name}  [${place.tags.join(" · ") || "—"}]`);
      }
    }

    if (candidates.length === 0) console.log("  (none)");
    const recommendation = candidates.some((tag) => tag.realA)
      ? "signal"
      : candidates.some((tag) => tag.realB)
        ? "filter"
        : "none";
    console.log(`  recomendación: ${recommendation}`);
    likes.push({ like, recommendation, candidates });
  }

  const outPath = join(scriptsDir, "recheck3-tags.out.json");
  await writeFile(outPath, `${JSON.stringify({ likes }, null, 2)}\n`, "utf8");
  console.error(`Wrote ${likes.length} likes to scripts/recheck3-tags.out.json`);
}

await main();
