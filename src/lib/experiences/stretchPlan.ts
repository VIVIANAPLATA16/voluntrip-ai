import {
  getConsentedFilterTagId,
  getConsentedLovedEntities,
  getConsentedQlooTagIds,
} from "@/lib/culture/profile";
import { MOCK_RATES_USD } from "@/lib/constants";
import { convertCurrency } from "@/lib/finance/currency";
import { buildBudgetSnapshot } from "@/lib/finance/budget";
import { canCompareTaste, normalizePlaceKey } from "./compareTaste";
import { discoverExperiences } from "./discovery";
import { financialFit, purchaseSimulationForCost } from "./evaluate";
import { rankExperiences } from "./rank";
import type { Experience } from "./types";
import type {
  BudgetSnapshot,
  CulturalProfile,
  Pocket,
  PurchaseSimulation,
  Transaction,
  Trip,
} from "@/types";
import type { QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";

export const STRETCH_NIGHT_OPTIONS = [2, 3, 5] as const;
export type StretchNights = (typeof STRETCH_NIGHT_OPTIONS)[number];

/** Same cultural-fit floor as rank.ts pickAlternative. */
export const STRETCH_CULTURAL_FLOOR = 60;

export interface StretchNight {
  night: number;
  place: Experience;
  weakerFit: boolean;
}

export interface StretchPlanVersion {
  kind: "best" | "stretched";
  nights: StretchNight[];
  totalEstimatedUsd: number;
  totalDisplay: number;
  displayCurrency: string;
  affordable: boolean;
  financialFit: number;
  simulation: PurchaseSimulation;
}

export interface StretchPlanReady {
  kind: "ready";
  city: string;
  requestedNights: StretchNights;
  usedNights: number;
  shortened: boolean;
  remainingDays: number;
  best: StretchPlanVersion;
  stretched: StretchPlanVersion;
  identical: boolean;
  savingsUsd: number;
  savingsDisplay: number;
  displayCurrency: string;
  rateAvailable: boolean;
  daysEquivalent: number | null;
  bothUnaffordable: boolean;
  pool: Experience[];
  signals: string[];
  filter?: string;
}

export type StretchPlanResult =
  | { kind: "needs_consent"; city: string }
  | { kind: "unavailable"; city: string }
  | { kind: "empty"; city: string }
  | StretchPlanReady;

export interface AssembleStretchPlanInput {
  city: string;
  candidates: Experience[];
  nights: StretchNights;
  snapshot: BudgetSnapshot;
  trip: Trip;
  transactions: Transaction[];
  pockets: Pocket[];
  now: Date;
  signals?: string[];
  filter?: string;
}

export interface RequestStretchPlanInput {
  city: string;
  nights?: unknown;
  trip: Trip;
  transactions: Transaction[];
  pockets: Pocket[];
  culturalProfile: CulturalProfile | null;
  searchPlaces: (query: QlooPlaceQuery) => Promise<QlooResult>;
  now?: Date;
}

interface CachedDiscovery {
  city: string;
  source: "qloo" | "empty" | "unavailable";
  experiences: Experience[];
  signals: string[];
  filter?: string;
}

const cache = new Map<string, CachedDiscovery>();
const inflight = new Map<string, Promise<CachedDiscovery>>();

export function resetStretchPlanCache(): void {
  cache.clear();
  inflight.clear();
}

export function clampStretchNights(value: unknown): StretchNights {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 2 || n === 5) return n;
  return 3;
}

export function parseStretchNightsFromText(text: string): StretchNights {
  const lower = text.toLowerCase();
  if (/\b5\b|cinco|cinco noches|5 nights/.test(lower)) return 5;
  if (/\b2\b|dos noches|duas noites|weekend|finde|fin de semana/.test(lower)) return 2;
  return 3;
}

export function hasKnownExchangeRate(currency: string): boolean {
  return typeof MOCK_RATES_USD[currency] === "number" && Number.isFinite(MOCK_RATES_USD[currency]);
}

export function convertUsdEstimate(
  amountUsd: number,
  baseCurrency: string
): { amount: number; currency: string; rateAvailable: boolean } {
  if (baseCurrency === "USD") {
    return { amount: roundMoney(amountUsd), currency: "USD", rateAvailable: true };
  }
  if (!hasKnownExchangeRate(baseCurrency)) {
    return { amount: roundMoney(amountUsd), currency: "USD", rateAvailable: false };
  }
  return {
    amount: roundMoney(convertCurrency(amountUsd, "USD", baseCurrency)),
    currency: baseCurrency,
    rateAvailable: true,
  };
}

export function daysEquivalentFromSavings(
  savingsUsd: number,
  snapshot: BudgetSnapshot,
  baseCurrency: string
): number | null {
  if (!hasKnownExchangeRate(baseCurrency) && baseCurrency !== "USD") return null;
  const daily = snapshot.dailySafeSpend;
  if (!(daily > 0)) return null;
  const savingsBase =
    baseCurrency === "USD" || !hasKnownExchangeRate(baseCurrency)
      ? savingsUsd
      : convertCurrency(savingsUsd, "USD", baseCurrency);
  return Math.round((savingsBase / daily) * 10) / 10;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function qlooOnly(candidates: readonly Experience[]): Experience[] {
  return candidates.filter(function (place) {
    return place.source === "qloo" && place.whyQloo.source === "qloo";
  });
}

function distinctPlaces(candidates: readonly Experience[]): Experience[] {
  const seen = new Set<string>();
  const out: Experience[] = [];
  for (const place of candidates) {
    const key = normalizePlaceKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

function pickBest(candidates: readonly Experience[], n: number): Experience[] {
  const sorted = [...candidates].sort(function (a, b) {
    if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
    return a.estimatedCost.amount - b.estimatedCost.amount;
  });
  return distinctPlaces(sorted).slice(0, n);
}

function pickStretched(
  candidates: readonly Experience[],
  n: number
): { places: Experience[]; weakerKeys: Set<string> } {
  const unique = distinctPlaces(candidates);
  const strong = unique
    .filter(function (place) {
      return place.culturalFit >= STRETCH_CULTURAL_FLOOR;
    })
    .sort(function (a, b) {
      if (a.estimatedCost.amount !== b.estimatedCost.amount) {
        return a.estimatedCost.amount - b.estimatedCost.amount;
      }
      return b.culturalFit - a.culturalFit;
    });

  const places: Experience[] = [];
  const used = new Set<string>();
  const weakerKeys = new Set<string>();

  for (const place of strong) {
    if (places.length >= n) break;
    places.push(place);
    used.add(normalizePlaceKey(place));
  }

  if (places.length < n) {
    const rest = unique
      .filter(function (place) {
        return !used.has(normalizePlaceKey(place));
      })
      .sort(function (a, b) {
        if (a.estimatedCost.amount !== b.estimatedCost.amount) {
          return a.estimatedCost.amount - b.estimatedCost.amount;
        }
        return b.culturalFit - a.culturalFit;
      });
    for (const place of rest) {
      if (places.length >= n) break;
      places.push(place);
      weakerKeys.add(normalizePlaceKey(place));
    }
  }

  return { places, weakerKeys };
}

function totalUsd(places: readonly Experience[]): number {
  return roundMoney(
    places.reduce(function (sum, place) {
      return sum + place.estimatedCost.amount;
    }, 0)
  );
}

function samePlaceSet(a: readonly Experience[], b: readonly Experience[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(normalizePlaceKey));
  if (keys.size !== a.length) return false;
  return b.every(function (place) {
    return keys.has(normalizePlaceKey(place));
  });
}

function toNights(places: readonly Experience[], weakerKeys: Set<string>): StretchNight[] {
  return places.map(function (place, index) {
    return {
      night: index + 1,
      place,
      weakerFit: weakerKeys.has(normalizePlaceKey(place)),
    };
  });
}

function versionFromPlaces(
  kind: StretchPlanVersion["kind"],
  places: Experience[],
  weakerKeys: Set<string>,
  input: AssembleStretchPlanInput
): StretchPlanVersion {
  const usd = totalUsd(places);
  const converted = convertUsdEstimate(usd, input.trip.baseCurrency);
  const finance = {
    trip: input.trip,
    transactions: input.transactions,
    pockets: input.pockets,
    now: input.now,
  };
  const simulation = purchaseSimulationForCost(usd, finance);
  const fit = financialFit(usd, input.snapshot, finance);
  return {
    kind,
    nights: toNights(places, weakerKeys),
    totalEstimatedUsd: usd,
    totalDisplay: converted.amount,
    displayCurrency: converted.currency,
    affordable: fit > 0 && simulation.affordable,
    financialFit: fit,
    simulation,
  };
}

function finishReady(
  input: AssembleStretchPlanInput,
  pool: Experience[],
  usedNights: number,
  bestPlaces: Experience[],
  stretchedPick: { places: Experience[]; weakerKeys: Set<string> }
): StretchPlanReady {
  const best = versionFromPlaces("best", bestPlaces, new Set(), input);
  const stretched = versionFromPlaces(
    "stretched",
    stretchedPick.places,
    stretchedPick.weakerKeys,
    input
  );
  const savingsUsd = roundMoney(best.totalEstimatedUsd - stretched.totalEstimatedUsd);
  const identical = samePlaceSet(bestPlaces, stretchedPick.places) || savingsUsd === 0;
  const converted = convertUsdEstimate(savingsUsd, input.trip.baseCurrency);
  const rateAvailable = converted.rateAvailable;
  return {
    kind: "ready",
    city: input.city,
    requestedNights: input.nights,
    usedNights,
    shortened: usedNights < input.nights,
    remainingDays: input.snapshot.daysRemaining,
    best,
    stretched,
    identical,
    savingsUsd,
    savingsDisplay: converted.amount,
    displayCurrency: converted.currency,
    rateAvailable,
    daysEquivalent: rateAvailable
      ? daysEquivalentFromSavings(savingsUsd, input.snapshot, input.trip.baseCurrency)
      : null,
    bothUnaffordable: !best.affordable && !stretched.affordable,
    pool,
    signals: input.signals ?? [],
    ...(input.filter ? { filter: input.filter } : {}),
  };
}

/** Pure: build both plans from already-ranked Qloo experiences. */
export function assembleStretchPlan(input: AssembleStretchPlanInput): StretchPlanResult {
  const city = input.city.trim();
  const pool = distinctPlaces(qlooOnly(input.candidates));
  if (pool.length === 0) return { kind: "empty", city };

  const usedNights = Math.max(
    1,
    Math.min(input.nights, input.snapshot.daysRemaining, pool.length)
  );
  const bestPlaces = pickBest(pool, usedNights);
  const stretchedPick = pickStretched(pool, usedNights);
  if (bestPlaces.length === 0 || stretchedPick.places.length === 0) {
    return { kind: "empty", city };
  }
  return finishReady(input, pool, usedNights, bestPlaces, stretchedPick);
}

/** Replace one night with the next unused Qloo candidate and recompute totals. */
export function swapStretchNight(
  result: StretchPlanReady,
  version: "best" | "stretched",
  nightIndex: number,
  finance: Pick<AssembleStretchPlanInput, "snapshot" | "trip" | "transactions" | "pockets" | "now">
): StretchPlanReady {
  const current = result[version];
  if (nightIndex < 0 || nightIndex >= current.nights.length) return result;

  const used = new Set(
    current.nights.map(function (night) {
      return normalizePlaceKey(night.place);
    })
  );
  const replacement = result.pool.find(function (place) {
    return !used.has(normalizePlaceKey(place));
  });
  if (!replacement) return result;

  const places = current.nights.map(function (night, index) {
    return index === nightIndex ? replacement : night.place;
  });
  const weakerKeys = new Set(
    current.nights
      .filter(function (night, index) {
        return index !== nightIndex && night.weakerFit;
      })
      .map(function (night) {
        return normalizePlaceKey(night.place);
      })
  );
  if (version === "stretched" && replacement.culturalFit < STRETCH_CULTURAL_FLOOR) {
    weakerKeys.add(normalizePlaceKey(replacement));
  }

  const input: AssembleStretchPlanInput = {
    city: result.city,
    candidates: result.pool,
    nights: result.requestedNights,
    snapshot: finance.snapshot,
    trip: finance.trip,
    transactions: finance.transactions,
    pockets: finance.pockets,
    now: finance.now,
    signals: result.signals,
    filter: result.filter,
  };
  const nextBest = version === "best" ? places : result.best.nights.map(function (n) {
    return n.place;
  });
  const nextStretched =
    version === "stretched"
      ? { places, weakerKeys }
      : {
          places: result.stretched.nights.map(function (n) {
            return n.place;
          }),
          weakerKeys: new Set(
            result.stretched.nights
              .filter(function (n) {
                return n.weakerFit;
              })
              .map(function (n) {
                return normalizePlaceKey(n.place);
              })
          ),
        };
  return finishReady(input, result.pool, result.usedNights, nextBest, nextStretched);
}

function cacheKey(
  city: string,
  signalIds: readonly string[],
  filterId: string | undefined,
  entityIds: readonly string[]
): string {
  return [
    city.trim().toLowerCase(),
    [...signalIds].sort().join(","),
    filterId ?? "",
    [...entityIds].sort().join(","),
  ].join("|");
}

async function loadQlooExperiences(
  input: RequestStretchPlanInput,
  city: string,
  signalIds: readonly string[],
  filterId: string | undefined,
  entityIds: readonly string[],
  entityNames: readonly string[]
): Promise<CachedDiscovery> {
  const key = cacheKey(city, signalIds, filterId, entityIds);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const run = (async function () {
    let discovery;
    try {
      discovery = await discoverExperiences(
        {
          city,
          profileTagIds: signalIds,
          filterTagId: filterId,
          entityIds,
          entityNames,
          consentGranted: true,
        },
        { searchPlaces: input.searchPlaces, now: input.now }
      );
    } catch {
      const miss: CachedDiscovery = { city, source: "unavailable", experiences: [], signals: [] };
      cache.set(key, miss);
      return miss;
    }

    if (discovery.source !== "qloo") {
      const miss: CachedDiscovery = {
        city,
        source: "unavailable",
        experiences: [],
        signals: [...discovery.signals, ...(discovery.entities ?? [])],
        ...(discovery.filter ? { filter: discovery.filter } : {}),
      };
      cache.set(key, miss);
      return miss;
    }
    if (discovery.candidates.length === 0) {
      const empty: CachedDiscovery = {
        city,
        source: "empty",
        experiences: [],
        signals: [...discovery.signals, ...(discovery.entities ?? [])],
        ...(discovery.filter ? { filter: discovery.filter } : {}),
      };
      cache.set(key, empty);
      return empty;
    }

    const ranked = rankExperiences({
      candidates: discovery.candidates,
      source: "qloo",
      queriedAt: discovery.queriedAt,
      qlooTotal: discovery.qlooTotal,
      signals: discovery.signals,
      filter: discovery.filter,
      entities: discovery.entities,
      profileTagIds: signalIds,
      intent: "tonight",
      trip: input.trip,
      transactions: input.transactions,
      pockets: input.pockets,
      now: input.now,
    });
    const stored: CachedDiscovery = {
      city,
      source: "qloo",
      experiences: qlooOnly(ranked.all),
      signals: [...discovery.signals, ...(discovery.entities ?? [])],
      ...(discovery.filter ? { filter: discovery.filter } : {}),
    };
    cache.set(key, stored);
    return stored;
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

/** One consented Qloo lookup (take 10), session-cached by city+signals+filter. */
export async function requestStretchPlan(
  input: RequestStretchPlanInput
): Promise<StretchPlanResult> {
  const city = input.city.trim();
  if (!canCompareTaste(input.culturalProfile)) {
    return { kind: "needs_consent", city };
  }

  const signalIds = getConsentedQlooTagIds(input.culturalProfile);
  const filterId = getConsentedFilterTagId(input.culturalProfile);
  const loved = getConsentedLovedEntities(input.culturalProfile);
  const entityIds = loved.map(function (entity) {
    return entity.id;
  });
  const entityNames = loved.map(function (entity) {
    return entity.name;
  });
  const nights = clampStretchNights(input.nights);
  const now = input.now ?? new Date();
  const snapshot = buildBudgetSnapshot(input.trip, input.transactions, input.pockets, now);
  const loaded = await loadQlooExperiences(input, city, signalIds, filterId, entityIds, entityNames);

  if (loaded.source === "unavailable") return { kind: "unavailable", city };
  if (loaded.source === "empty" || loaded.experiences.length === 0) {
    return { kind: "empty", city };
  }

  return assembleStretchPlan({
    city,
    candidates: loaded.experiences,
    nights,
    snapshot,
    trip: input.trip,
    transactions: input.transactions,
    pockets: input.pockets,
    now,
    signals: loaded.signals,
    filter: loaded.filter,
  });
}
