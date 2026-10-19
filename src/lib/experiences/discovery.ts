import { toQlooSignalTags } from "@/lib/culture/tagMap";
import { QLOO_MAX_TAGS } from "@/lib/qloo/types";
import type { QlooPlace, QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import type { DiscoveryResult } from "./types";

export const HOTEL_TAG_PREFIXES = [
  "urn:tag:genre:place:hotel",
  "urn:tag:category:place:hotel",
] as const;

export function isHotelCandidate(place: Pick<QlooPlace, "tags">): boolean {
  return place.tags.some((tag) =>
    HOTEL_TAG_PREFIXES.some((prefix) => tag.id.startsWith(prefix))
  );
}

export interface DiscoverExperiencesInput {
  city: string;
  /** Caller should pass consented profile tag IDs. Ignored when consent is false. */
  profileTagIds: readonly string[];
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
    ? toQlooSignalTags(input.profileTagIds).slice(0, QLOO_MAX_TAGS)
    : [];

  const result = await options.searchPlaces({
    city: input.city,
    tags,
    take: 10,
  });

  const queriedAt = (options.now ?? new Date()).toISOString();
  const candidates = result.places.filter((place) => !isHotelCandidate(place));

  if (result.source === "qloo") {
    return {
      source: "qloo",
      queriedAt,
      candidates,
      qlooTotal: result.places.length,
    };
  }

  if (result.source === "demo") {
    return {
      source: "demo",
      reason: result.reason,
      queriedAt,
      candidates,
      qlooTotal: result.places.length,
    };
  }

  return {
    source: "unavailable",
    reason: result.reason,
    queriedAt,
    candidates: [],
    qlooTotal: 0,
  };
}
