import {
  getConsentedFilterTagId,
  getConsentedQlooTagIds,
} from "@/lib/culture/profile";
import type { CulturalProfile, Pocket, Transaction, Trip } from "@/types";
import type { QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import { discoverExperiences } from "./discovery";
import { rankExperiences } from "./rank";
import type { DiscoveryResult, Experience } from "./types";

export type CompareColumnStatus = "ok" | "empty" | "unavailable";

export interface CompareTasteColumn {
  status: CompareColumnStatus;
  source: "qloo" | "demo" | "unavailable";
  places: Experience[];
  signals: string[];
}

export type CompareTasteResult =
  | { kind: "needs_consent"; city: string }
  | {
      kind: "ready";
      city: string;
      without: CompareTasteColumn;
      withTaste: CompareTasteColumn;
      changedCount: number | null;
      signals: string[];
    };

export interface CompareTasteInput {
  city: string;
  trip: Trip;
  transactions: Transaction[];
  pockets: Pocket[];
  culturalProfile: CulturalProfile | null;
  searchPlaces: (query: QlooPlaceQuery) => Promise<QlooResult>;
  now?: Date;
}

const TOP = 3;
const cache = new Map<string, CompareTasteResult>();
const inflight = new Map<string, Promise<CompareTasteResult>>();

export function resetCompareTasteCache(): void {
  cache.clear();
  inflight.clear();
}

export function canCompareTaste(profile: CulturalProfile | null | undefined): boolean {
  return hasTaste(profile ?? null);
}

export function normalizePlaceKey(place: { id: string; name: string }): string {
  const id = place.id.trim().toLowerCase();
  if (id) return "id:" + id;
  return "name:" + place.name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function countChangedPlaces(
  without: readonly { id: string; name: string }[],
  withTaste: readonly { id: string; name: string }[]
): number {
  const left = new Set(without.map(normalizePlaceKey));
  const right = new Set(withTaste.map(normalizePlaceKey));
  let onlyLeft = 0;
  let onlyRight = 0;
  left.forEach(function (key) {
    if (!right.has(key)) onlyLeft += 1;
  });
  right.forEach(function (key) {
    if (!left.has(key)) onlyRight += 1;
  });
  return Math.min(TOP, Math.max(onlyLeft, onlyRight));
}

function cacheKey(city: string, signalIds: readonly string[], filterId?: string): string {
  return [city.trim().toLowerCase(), [...signalIds].sort().join(","), filterId ?? ""].join("|");
}

function hasTaste(profile: CulturalProfile | null): boolean {
  if (!profile?.consent.granted) return false;
  return getConsentedQlooTagIds(profile).length > 0 || Boolean(getConsentedFilterTagId(profile));
}

function unavailableDiscovery(now?: Date): DiscoveryResult {
  return {
    source: "unavailable",
    reason: "QLOO_NETWORK",
    queriedAt: (now ?? new Date()).toISOString(),
    candidates: [],
    qlooTotal: 0,
    signals: [],
  };
}

async function discoverSafe(
  input: Parameters<typeof discoverExperiences>[0],
  options: Parameters<typeof discoverExperiences>[1]
): Promise<DiscoveryResult> {
  try {
    return await discoverExperiences(input, options);
  } catch {
    return unavailableDiscovery(options.now);
  }
}

function columnFromDiscovery(
  discovery: DiscoveryResult,
  input: CompareTasteInput,
  profileTagIds: readonly string[]
): CompareTasteColumn {
  if (discovery.source !== "qloo") {
    return {
      status: "unavailable",
      source: discovery.source,
      places: [],
      signals: discovery.signals,
    };
  }
  if (discovery.candidates.length === 0) {
    return {
      status: "empty",
      source: "qloo",
      places: [],
      signals: discovery.signals,
    };
  }
  const ranked = rankExperiences({
    candidates: discovery.candidates,
    source: discovery.source,
    queriedAt: discovery.queriedAt,
    qlooTotal: discovery.qlooTotal,
    signals: discovery.signals,
    filter: discovery.filter,
    profileTagIds,
    intent: "tonight",
    trip: input.trip,
    transactions: input.transactions,
    pockets: input.pockets,
    now: input.now,
  });
  return {
    status: "ok",
    source: "qloo",
    places: ranked.all.slice(0, TOP),
    signals: discovery.signals,
  };
}

/** Two Qloo lookups for the same city: default ranking vs Cultural DNA. Session-cached. */
export async function compareTaste(input: CompareTasteInput): Promise<CompareTasteResult> {
  const city = input.city.trim();
  const profile = input.culturalProfile;
  if (!hasTaste(profile)) {
    return { kind: "needs_consent", city };
  }

  const signalIds = getConsentedQlooTagIds(profile);
  const filterId = getConsentedFilterTagId(profile);
  const key = cacheKey(city, signalIds, filterId);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const run = (async function () {
    const [withoutDiscovery, withDiscovery] = await Promise.all([
      discoverSafe(
        { city, profileTagIds: [], consentGranted: false },
        { searchPlaces: input.searchPlaces, now: input.now }
      ),
      discoverSafe(
        {
          city,
          profileTagIds: signalIds,
          filterTagId: filterId,
          consentGranted: true,
        },
        { searchPlaces: input.searchPlaces, now: input.now }
      ),
    ]);

    const without = columnFromDiscovery(withoutDiscovery, input, signalIds);
    const withTaste = columnFromDiscovery(withDiscovery, input, signalIds);
    const changedCount =
      without.status === "ok" && withTaste.status === "ok"
        ? countChangedPlaces(without.places, withTaste.places)
        : null;

    const result: CompareTasteResult = {
      kind: "ready",
      city,
      without,
      withTaste,
      changedCount,
      signals: withDiscovery.signals,
    };
    cache.set(key, result);
    return result;
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}
