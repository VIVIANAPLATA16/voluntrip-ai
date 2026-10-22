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

/** Lowercase, strip accents, collapse spaces — used to drop duplicate place names. */
export function foldPlaceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isHotelCandidate(place: Pick<QlooPlace, "tags">): boolean {
  return place.tags.some(function (tag) {
    const id = tag.id.trim().toLowerCase();
    if (HOTEL_TAG_PREFIXES.some((prefix) => id.startsWith(prefix))) return true;
    const parts = id.split(":");
    if (
      parts.some(function (part) {
        return LODGING_ID_MARKERS.some(function (marker) {
          return part === marker || part.startsWith(marker + "_") || part.startsWith(marker + "-");
        });
      })
    ) {
      return true;
    }
    return LODGING_NAME_RE.test(foldPlaceName(tag.name));
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
  const entityIds = input.consentGranted
    ? uniqueEntityIds(input.entityIds)
    : [];
  const entityNames = input.consentGranted
    ? uniqueNames(input.entityNames).slice(0, entityIds.length || QLOO_MAX_ENTITIES)
    : [];
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
  const stripped = result.places.filter((place) => !isHotelCandidate(place));
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

function uniqueEntityIds(ids: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids ?? []) {
    const id = raw.trim().toLowerCase();
    if (!QLOO_ENTITY_UUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= QLOO_MAX_ENTITIES) break;
  }
  return out;
}

function uniqueNames(names: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names ?? []) {
    const name = raw.trim();
    const key = foldPlaceName(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
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
