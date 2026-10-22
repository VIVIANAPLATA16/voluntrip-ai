import {
  CULTURAL_DNA_MAX_SIGNALS,
  allCulturalDnaTags,
  findCulturalDnaTag,
  toQlooSignalTags,
} from "@/lib/culture/tagMap";
import { QLOO_ENTITY_UUID, QLOO_MAX_ENTITIES } from "@/lib/qloo/types";
import type { QlooPlace, QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import type { DiscoveryResult } from "./types";

export const HOTEL_TAG_PREFIXES = [
  "urn:tag:genre:place:hotel",
  "urn:tag:category:place:hotel",
] as const;

const MIN_ENTITY_PLACES = 3;

const LODGING_NAME_RE =
  /(^|[^a-z])(hotel|hotels|lodging|lodgings|accommodation|accommodations|hostel|hostels|resort|resorts|motel|motels|inn|inns|guesthouse|guesthouses)([^a-z]|$)/;

const LODGING_ID_MARKERS = [
  "hotel",
  "lodging",
  "accommodation",
  "hostel",
  "resort",
  "motel",
  "inn",
  "guesthouse",
  "guest_house",
];

/**
 * Last-segment tokens from the same `urn:tag:…:place:{token}` shape used in
 * fixtures (`genre:place:hotel`, `category:place:lodging`, `genre:place:bar`).
 * No university/college/school tags exist in the repo yet — markers follow
 * that colon-part convention, not guessed full URNs.
 */
export const NON_TOURIST_ID_MARKERS = [
  "university",
  "college",
  "school",
  "condominium",
  "residential",
  "apartment",
  "hospital",
  "clinic",
  "government",
  "bank",
] as const;

/** Lowercase, strip accents, collapse spaces — used to drop duplicate place names. */
export function foldPlaceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tagIdHasMarker(id: string, markers: readonly string[]): boolean {
  const parts = id.trim().toLowerCase().split(":");
  return parts.some(function (part) {
    return markers.some(function (marker) {
      return part === marker || part.startsWith(marker + "_") || part.startsWith(marker + "-");
    });
  });
}

export function isHotelCandidate(place: Pick<QlooPlace, "tags">): boolean {
  return place.tags.some(function (tag) {
    const id = tag.id.trim().toLowerCase();
    if (HOTEL_TAG_PREFIXES.some((prefix) => id.startsWith(prefix))) return true;
    if (tagIdHasMarker(id, LODGING_ID_MARKERS)) return true;
    return LODGING_NAME_RE.test(foldPlaceName(tag.name));
  });
}

/** True when a Qloo tag id part marks a non-tourist place. Never matches on place names. */
export function isNonTouristCandidate(place: Pick<QlooPlace, "tags">): boolean {
  return place.tags.some(function (tag) {
    return tagIdHasMarker(tag.id, NON_TOURIST_ID_MARKERS);
  });
}

export function dedupePlacesByName(places: readonly QlooPlace[]): QlooPlace[] {
  const seen = new Set<string>();
  const out: QlooPlace[] = [];
  for (const place of places) {
    const key = foldPlaceName(place.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

export interface DiscoverExperiencesInput {
  city: string;
  /** Caller should pass consented profile tag IDs. Ignored when consent is false. */
  profileTagIds: readonly string[];
  /** At most one verified filter tag. Ignored when consent is false. */
  filterTagId?: string;
  /** Consented Qloo entity UUIDs. Ignored when consent is false. */
  entityIds?: readonly string[];
  /** Readable names for the entity UUIDs, shown in whyQloo. */
  entityNames?: readonly string[];
  consentGranted: boolean;
}

export interface DiscoverExperiencesOptions {
  /** Required so callers choose API-proxy (browser) vs server client. Never default to the key-holding client. */
  searchPlaces: (query: QlooPlaceQuery) => Promise<QlooResult>;
  now?: Date;
}

/**
 * Fetch place candidates for a city. Never fabricates Qloo entities:
 * results are whatever the Qloo client returns (live, labeled demo, or unavailable).
 */
export async function discoverExperiences(
  input: DiscoverExperiencesInput,
  options: DiscoverExperiencesOptions
): Promise<DiscoveryResult> {
  const tags = input.consentGranted
    ? toQlooSignalTags(input.profileTagIds).slice(0, CULTURAL_DNA_MAX_SIGNALS)
    : [];
  const filterTagId =
    input.consentGranted && input.filterTagId?.trim() ? input.filterTagId.trim() : undefined;
  const filterTags = filterTagId ? [filterTagId] : undefined;
  const loved = input.consentGranted
    ? pairLovedEntities(input.entityIds, input.entityNames)
    : [];
  const entityIds = loved.map(function (entity) {
    return entity.id;
  });
  const entityNames = loved.map(function (entity) {
    return entity.name;
  });
  const signals = signalLabels(tags);
  const filter = filterTagId
    ? findCulturalDnaTag(filterTagId)?.label ?? filterTagId
    : undefined;

  const result = await options.searchPlaces({
    city: input.city,
    tags,
    ...(filterTags ? { filterTags } : {}),
    ...(entityIds.length > 0 ? { entities: entityIds } : {}),
    take: 10,
  });

  const queriedAt = (options.now ?? new Date()).toISOString();
  const stripped = result.places.filter(
    (place) => !isHotelCandidate(place) && !isNonTouristCandidate(place)
  );
  const deduped = dedupePlacesByName(stripped);
  const usedEntities = entityIds.length > 0;
  const candidates = usedEntities && deduped.length < MIN_ENTITY_PLACES ? [] : deduped;

  if (result.source === "qloo") {
    return {
      source: "qloo",
      queriedAt,
      candidates,
      qlooTotal: result.places.length,
      signals,
      ...(filter ? { filter } : {}),
      ...(entityNames.length > 0 ? { entities: entityNames } : {}),
    };
  }

  if (result.source === "demo") {
    return {
      source: "demo",
      reason: result.reason,
      queriedAt,
      candidates,
      qlooTotal: result.places.length,
      signals: [],
    };
  }

  return {
    source: "unavailable",
    reason: result.reason,
    queriedAt,
    candidates: [],
    qlooTotal: 0,
    signals: [],
  };
}

function pairLovedEntities(
  ids: readonly string[] | undefined,
  names: readonly string[] | undefined
): Array<{ id: string; name: string }> {
  const rawIds = ids ?? [];
  const rawNames = names ?? [];
  const out: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawIds.length; i++) {
    const id = rawIds[i]?.trim().toLowerCase() ?? "";
    const name = (rawNames[i] ?? "").trim();
    if (!id || !name || !QLOO_ENTITY_UUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
    if (out.length >= QLOO_MAX_ENTITIES) break;
  }
  return out;
}

function signalLabels(ids: readonly string[]): string[] {
  const catalog = allCulturalDnaTags();
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const label = catalog.find((tag) => tag.qlooTagId === id)?.label ?? id;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}
