#!/usr/bin/env node
/**
 * Recheck likes with a looser filler threshold and extra candidate IDs.
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
const TAKE_TAGS = 20;
const TAKE_PLACES = 10;
const FALLBACK_OVERLAP = 8;
const INVALID_TAG = "urn:tag:genre:place:zz_invalid_tag";
const HOTEL_TAG_PREFIXES = ["urn:tag:genre:place:hotel", "urn:tag:category:place:hotel"];
const ALLOWED_PREFIXES = [
  "urn:tag:genre:",
  "urn:tag:offerings:",
  "urn:tag:amenity:",
  "urn:tag:specialty_dish:",
];
const CONTROLS = [
  { like: "nightlife", id: "urn:tag:genre:place:nightlife", label: "Nightlife" },
  { like: "salsa", id: "urn:tag:genre:music:salsa", label: "Salsa" },
];

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

const SYNONYMS = {
  yoga: ["yoga studio", "yoga", "pilates", "meditation"],
  markets: ["farmers market", "flea market", "market", "food market", "public market"],
  bike: ["cycling", "bicycle", "bike rental", "bike shop", "bike path"],
  wellness: ["wellness", "health", "healthy", "spa and wellness"],
  rock: ["rock music", "rock", "rock bar", "rock club"],
  "live music": ["live music", "concert", "music venue", "live band"],
  "art galleries": ["art gallery", "gallery", "art", "contemporary art"],
  cinema: ["movie theater", "cinema", "film"],
  bookstores: ["bookstore", "book store", "books", "library"],
  parks: ["park", "nature", "garden", "outdoors"],
  tours: ["tour", "walking tour", "sightseeing", "tourist attraction"],
};

const DIRECT_IDS = {
  rock: ["urn:tag:genre:music:rock"],
  "hip hop": ["urn:tag:genre:music:hip_hop", "urn:tag:genre:media:hip_hop"],
  indie: ["urn:tag:genre:music:indie"],
  latin: ["urn:tag:genre:music:latin"],
  classical: ["urn:tag:genre:music:classical"],
  "street food": ["urn:tag:genre:place:restaurant:street_food"],
  coffee: ["urn:tag:offerings:place:coffee", "urn:tag:genre:place:restaurant:coffee_shop"],
  "craft beer": ["urn:tag:offerings:place:craft_beer"],
  cocktails: ["urn:tag:offerings:place:cocktails"],
  wine: ["urn:tag:offerings:place:wine", "urn:tag:genre:place:wine_bar"],
  brunch: ["urn:tag:dining_options:place:brunch"],
  desserts: [
    "urn:tag:genre:place:restaurant:dessert",
    "urn:tag:specialty_dish:place:desserts",
  ],
  nightlife: ["urn:tag:genre:place:nightlife"],
  museums: ["urn:tag:genre:place:museum", "urn:tag:genre:media:museums"],
  theater: ["urn:tag:genre:place:theater", "urn:tag:offerings:place:theater"],
  karaoke: ["urn:tag:amenity:place:karaoke"],
  cinema: ["urn:tag:genre:place:movie_theater"],
  "dance club": ["urn:tag:genre:place:dance_club"],
  yoga: ["urn:tag:genre:place:yoga_studio"],
  rooftop: ["urn:tag:amenity:place:rooftop_terrace"],
  coworking: ["urn:tag:genre:place:coworking_space"],
  spa: ["urn:tag:genre:place:spa"],
  shopping: ["urn:tag:genre:place:shopping_mall", "urn:tag:genre:place:shopping"],
  wellness: ["urn:tag:genre:place:spa"],
};

const apiKey = process.env.QLOO_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing QLOO_API_KEY in the environment. Export it in this shell and run again.");
  process.exit(1);
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const LIKES = Object.values(QUERIES).flat();

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

function isAllowedSearchTag(tag) {
  const id = tag.id.toLowerCase();
  if (id.includes(":category:")) return false;
  if (isHotelId(id)) return false;
  return ALLOWED_PREFIXES.some((prefix) => id.startsWith(prefix));
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

async function fetchPlaces(tagId) {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(insightsPath(tagId));
  return placeNames(normalizePlacesPayload(payload));
}

async function fetchSearchTags(query) {
  await sleep(PAUSE_MS);
  const payload = await qlooGet(tagsPath(query));
  return normalizeTagsPayload(payload).filter(isAllowedSearchTag);
}

async function readJson(filename) {
  try {
    return JSON.parse(await readFile(join(scriptsDir, filename), "utf8"));
  } catch {
    console.error(`Could not read ${filename}. Run the earlier probe first.`);
    process.exit(1);
  }
}

function addCandidate(byId, id, label) {
  if (!id || isHotelId(id)) return;
  const existing = byId.get(id);
  if (!existing) byId.set(id, { id, label: label || id });
  else if (label && existing.label === existing.id) existing.label = label;
}

function idsFromVerified(rows, like) {
  const byId = new Map();
  if (!Array.isArray(rows)) return byId;
  for (const row of rows) {
    if (!isRecord(row) || row.query !== like) continue;
    const id = asNonEmptyString(row.tagId);
    if (id) addCandidate(byId, id, asNonEmptyString(row.label) ?? like);
  }
  return byId;
}

function idsFromFix(rows, like) {
  const byId = new Map();
  if (!Array.isArray(rows)) return byId;
  for (const row of rows) {
    if (!isRecord(row) || row.like !== like) continue;
    const candidates = Array.isArray(row.verified) ? row.verified : [];
    for (const item of candidates) {
      if (!isRecord(item)) continue;
      const id = asNonEmptyString(item.id);
      if (id) addCandidate(byId, id, asNonEmptyString(item.label) ?? like);
    }
  }
  return byId;
}

function printCandidate(status, tag) {
  console.log(
    `  ${status.padEnd(8)} ${tag.id}  a=${tag.overlapA}/${TAKE_PLACES}  b=${tag.overlapB}/${TAKE_PLACES}`
  );
  console.log(`           ${tag.label}`);
  console.log(`           ${tag.places.join(" · ") || "—"}`);
}

async function scoreTag(id, label, baselineSet, invalidSet) {
  const names = await fetchPlaces(id);
  const overlapA = overlapCount(names, baselineSet);
  const overlapB = overlapCount(names, invalidSet);
  const status =
    overlapA >= FALLBACK_OVERLAP || overlapB >= FALLBACK_OVERLAP ? "FALLBACK" : "REAL";
  return {
    id,
    label,
    status,
    overlapA,
    overlapB,
    places: names.slice(0, 3),
  };
}

async function main() {
  const verifiedRows = await readJson("verified-tags.out.json");
  const fixRows = await readJson("fix-tags.out.json");

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

  console.log("Controles");
  const controls = [];
  for (const control of CONTROLS) {
    try {
      const scored = await scoreTag(control.id, control.label, baselineSet, invalidSet);
      controls.push({ like: control.like, ...scored });
      printCandidate(scored.status, scored);
    } catch {
      console.log(`  ${control.id}  (request failed)`);
    }
  }

  const likes = [];
  const likesWithoutReal = [];

  for (const like of LIKES) {
    const byId = new Map();
    for (const tag of idsFromVerified(verifiedRows, like).values()) addCandidate(byId, tag.id, tag.label);
    for (const tag of idsFromFix(fixRows, like).values()) addCandidate(byId, tag.id, tag.label);
    for (const id of DIRECT_IDS[like] ?? []) addCandidate(byId, id, like);

    const synonyms = SYNONYMS[like] ?? [like];
    for (const query of synonyms) {
      try {
        const tags = await fetchSearchTags(query);
        for (const tag of tags) addCandidate(byId, tag.id, tag.label);
      } catch {
        continue;
      }
    }

    console.log(`\n${like}`);
    const candidates = [];
    for (const tag of byId.values()) {
      let scored;
      try {
        scored = await scoreTag(tag.id, tag.label, baselineSet, invalidSet);
      } catch {
        scored = {
          id: tag.id,
          label: tag.label,
          status: "FALLBACK",
          overlapA: 0,
          overlapB: 0,
          places: [],
        };
      }
      candidates.push(scored);
      printCandidate(scored.status, scored);
    }

    if (candidates.length === 0) console.log("  (none)");
    if (!candidates.some((tag) => tag.status === "REAL")) likesWithoutReal.push(like);
    likes.push({ like, candidates });
  }

  console.log("\nGustos sin tag REAL:");
  if (likesWithoutReal.length === 0) console.log("  (none)");
  else for (const like of likesWithoutReal) console.log(`  ${like}`);

  const outPath = join(scriptsDir, "recheck2-tags.out.json");
  await writeFile(
    outPath,
    `${JSON.stringify({ controls, likes, likesWithoutReal }, null, 2)}\n`,
    "utf8"
  );
  console.error(`Wrote ${likes.length} likes to scripts/recheck2-tags.out.json`);
}

await main();
