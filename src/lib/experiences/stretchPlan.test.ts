import { afterEach, describe, expect, it, vi } from "vitest";
import type { BudgetSnapshot, CulturalProfile, Experience, Pocket, Trip } from "@/types";
import type { QlooPlace, QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import { convertCurrency } from "@/lib/finance/currency";
import { buildBudgetSnapshot } from "@/lib/finance/budget";
import { prepareDemoBudgetContext } from "@/lib/demo/remainingDays";
import {
  assembleStretchPlan,
  clampStretchNights,
  daysEquivalentFromSavings,
  parseStretchNightsFromText,
  requestStretchPlan,
  resetStretchPlanCache,
  swapStretchNight,
} from "./stretchPlan";

const SALSA = "urn:tag:genre:music:salsa";
const now = new Date("2026-10-19T12:00:00.000Z");

const trip: Trip = {
  id: "t-stretch",
  destination: "Lima, Peru",
  city: "Lima",
  country: "Peru",
  countryCode: "PE",
  flag: "🇵🇪",
  baseCurrency: "USD",
  localCurrency: "PEN",
  startDate: "2026-10-01",
  endDate: "2026-11-15",
  initialBudget: 1200,
  includedBenefits: ["accommodation"],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const pockets: Pocket[] = [];

const consented: CulturalProfile = {
  id: "default",
  consent: { granted: true, grantedAt: "2026-10-19T00:00:00.000Z" },
  music: [{ label: "salsa", qlooTagId: SALSA }],
  food: [],
  entertainment: [],
  activities: [],
  updatedAt: "2026-10-19T00:00:00.000Z",
};

function snapshotFor(t: Trip = trip, clock: Date = now): BudgetSnapshot {
  return buildBudgetSnapshot(t, [], pockets, clock);
}

function exp(partial: {
  id: string;
  name: string;
  cost: number;
  culturalFit: number;
  valueScore: number;
  source?: Experience["source"];
  neighborhood?: string;
}): Experience {
  const source = partial.source ?? "qloo";
  return {
    id: partial.id,
    name: partial.name,
    neighborhood: partial.neighborhood,
    tags: [{ id: SALSA, name: "Salsa", type: "urn:tag:genre:music" }],
    popularity: 0.5,
    priceLevel: 2,
    source,
    estimatedCost: { amount: partial.cost, basis: "price_level", isEstimate: true },
    culturalFit: partial.culturalFit,
    financialFit: 80,
    contextFit: 50,
    valueScore: partial.valueScore,
    whyQloo: {
      matchedTags: [SALSA],
      rank: 1,
      source,
      queriedAt: now.toISOString(),
      signals: ["salsa"],
      totalResults: 6,
    },
    whyVoluntrip: {
      estimatedCost: { amount: partial.cost, basis: "price_level", isEstimate: true },
      dailySafeSpendBefore: 100,
      dailySafeSpendAfter: 90,
      protectedMoneyUntouched: true,
      runwayStatus: "on_track",
    },
  };
}

const pool: Experience[] = [
  exp({ id: "a", name: "Alpha", cost: 80, culturalFit: 90, valueScore: 92, neighborhood: "Centro" }),
  exp({ id: "b", name: "Beta", cost: 80, culturalFit: 85, valueScore: 88 }),
  exp({ id: "c", name: "Gamma", cost: 80, culturalFit: 80, valueScore: 84 }),
  exp({ id: "d", name: "Delta", cost: 20, culturalFit: 70, valueScore: 60 }),
  exp({ id: "e", name: "Epsilon", cost: 20, culturalFit: 65, valueScore: 55 }),
  exp({ id: "f", name: "Zeta", cost: 20, culturalFit: 62, valueScore: 50 }),
];

function assemble(
  candidates: Experience[],
  nights: 2 | 3 | 5 = 3,
  t: Trip = trip,
  clock: Date = now
) {
  return assembleStretchPlan({
    city: t.city,
    candidates,
    nights,
    snapshot: snapshotFor(t, clock),
    trip: t,
    transactions: [],
    pockets,
    now: clock,
    signals: ["salsa"],
  });
}

function qlooPlace(id: string, name: string, rank: number, priceLevel: 1 | 2 | 3 | 4 = 2): QlooPlace {
  return {
    id,
    name,
    rank,
    tags: [{ id: SALSA, name: "Salsa", type: "urn:tag:genre:music" }],
    popularity: 0.6,
    priceLevel,
  };
}

afterEach(function () {
  resetStretchPlanCache();
});

describe("clamp and parse nights", () => {
  it("accepts only 2, 3 or 5", () => {
    expect(clampStretchNights(2)).toBe(2);
    expect(clampStretchNights(5)).toBe(5);
    expect(clampStretchNights(3)).toBe(3);
    expect(clampStretchNights(4)).toBe(3);
    expect(clampStretchNights(undefined)).toBe(3);
  });

  it("reads 2/3/5 from en/es/pt phrases", () => {
    expect(parseStretchNightsFromText("plan 5 nights")).toBe(5);
    expect(parseStretchNightsFromText("planea 2 noches")).toBe(2);
    expect(parseStretchNightsFromText("plan my weekend")).toBe(2);
    expect(parseStretchNightsFromText("armar plan")).toBe(3);
  });
});

describe("assembleStretchPlan", () => {
  it("picks highest Value Score vs cheapest culturalFit >= 60 and reports known savings", () => {
    const result = assemble(pool, 3);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.best.nights.map(function (n) { return n.place.id; })).toEqual(["a", "b", "c"]);
    expect(result.stretched.nights.map(function (n) { return n.place.id; })).toEqual(["d", "e", "f"]);
    expect(result.best.totalEstimatedUsd).toBe(240);
    expect(result.stretched.totalEstimatedUsd).toBe(60);
    expect(result.savingsUsd).toBe(180);
    const daily = snapshotFor().dailySafeSpend;
    expect(result.daysEquivalent).toBe(Math.round((180 / daily) * 10) / 10);
    expect(result.best.nights[0].place.estimatedCost.isEstimate).toBe(true);
    expect(result.identical).toBe(false);
    expect(result.bothUnaffordable).toBe(false);
  });

  it("shortens the plan when there are fewer places than N", () => {
    const result = assemble(pool.slice(0, 2), 5);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.usedNights).toBe(2);
    expect(result.shortened).toBe(true);
    expect(result.requestedNights).toBe(5);
  });

  it("caps N by remaining trip days", () => {
    const shortTrip: Trip = {
      ...trip,
      startDate: "2026-10-19",
      endDate: "2026-10-20",
    };
    const result = assemble(pool, 5, shortTrip);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.usedNights).toBeLessThanOrEqual(snapshotFor(shortTrip).daysRemaining);
    expect(result.shortened).toBe(true);
  });

  it("marks both plans unaffordable when the total exceeds real available", () => {
    const tight: Trip = { ...trip, initialBudget: 40 };
    const result = assemble(pool, 3, tight);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.best.affordable).toBe(false);
    expect(result.stretched.affordable).toBe(false);
    expect(result.best.financialFit).toBe(0);
    expect(result.stretched.financialFit).toBe(0);
    expect(result.bothUnaffordable).toBe(true);
  });

  it("fills with weaker cultural fit when nobody is at 60", () => {
    const weak = pool.map(function (place) {
      return { ...place, culturalFit: 40 };
    });
    const result = assemble(weak, 3);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.stretched.nights.every(function (n) { return n.weakerFit; })).toBe(true);
    expect(result.stretched.nights).toHaveLength(3);
  });

  it("breaks Value Score ties by cheaper estimated cost", () => {
    const tied = [
      exp({ id: "x", name: "X", cost: 40, culturalFit: 80, valueScore: 70 }),
      exp({ id: "y", name: "Y", cost: 20, culturalFit: 80, valueScore: 70 }),
      exp({ id: "z", name: "Z", cost: 80, culturalFit: 80, valueScore: 70 }),
    ];
    const result = assemble(tied, 2);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.best.nights[0].place.id).toBe("y");
  });

  it("says the plans are identical when the best match is already cheapest", () => {
    const same = pool.slice(0, 3).map(function (place) {
      return { ...place, estimatedCost: { ...place.estimatedCost, amount: 20 }, culturalFit: 80 };
    });
    const result = assemble(same, 3);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.identical).toBe(true);
    expect(result.savingsUsd).toBe(0);
    expect(result.daysEquivalent).toBe(0);
  });

  it("swaps a night for the next unused candidate and recomputes savings", () => {
    const result = assemble(pool, 3);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    const swapped = swapStretchNight(result, "best", 0, {
      snapshot: snapshotFor(),
      trip,
      transactions: [],
      pockets,
      now,
    });
    expect(swapped.best.nights[0].place.id).toBe("d");
    expect(swapped.best.totalEstimatedUsd).toBe(180);
    expect(swapped.savingsUsd).toBe(120);
    expect(swapped.stretched.nights.map(function (n) { return n.place.id; })).toEqual(["d", "e", "f"]);
  });

  it("converts totals to COP / THB / SGD and omits days when the rate is missing", () => {
    const copTrip: Trip = { ...trip, baseCurrency: "COP" };
    const cop = assemble(pool, 3, copTrip);
    expect(cop.kind).toBe("ready");
    if (cop.kind === "ready") {
      expect(cop.displayCurrency).toBe("COP");
      expect(cop.rateAvailable).toBe(true);
      expect(cop.savingsDisplay).toBe(Math.round(convertCurrency(180, "USD", "COP") * 100) / 100);
      expect(cop.daysEquivalent).not.toBeNull();
    }

    const thbTrip: Trip = { ...trip, baseCurrency: "THB" };
    const thb = assemble(pool, 3, thbTrip);
    expect(thb.kind === "ready" && thb.displayCurrency).toBe("THB");

    const sgdTrip: Trip = { ...trip, baseCurrency: "SGD" };
    const sgd = assemble(pool, 3, sgdTrip);
    expect(sgd.kind === "ready" && sgd.displayCurrency).toBe("SGD");

    const xyzTrip: Trip = { ...trip, baseCurrency: "XYZ" };
    const xyz = assemble(pool, 3, xyzTrip);
    expect(xyz.kind).toBe("ready");
    if (xyz.kind === "ready") {
      expect(xyz.displayCurrency).toBe("USD");
      expect(xyz.rateAvailable).toBe(false);
      expect(xyz.daysEquivalent).toBeNull();
    }
  });

  it("never includes demo, unavailable, or baseline places", () => {
    const mixed = [
      exp({ id: "demo-1", name: "Other city", cost: 8, culturalFit: 99, valueScore: 99, source: "demo" }),
      exp({ id: "gone", name: "Gone", cost: 8, culturalFit: 99, valueScore: 99, source: "unavailable" }),
      ...pool,
    ];
    const result = assemble(mixed, 3);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    const ids = result.pool.map(function (p) { return p.id; });
    expect(ids).not.toContain("demo-1");
    expect(ids).not.toContain("gone");
    expect(result.best.nights.every(function (n) { return n.place.source === "qloo"; })).toBe(true);
  });
});

describe("requestStretchPlan cities and consent", () => {
  function live(places: QlooPlace[]): Extract<QlooResult, { source: "qloo" }> {
    return { source: "qloo", places };
  }

  async function runCity(city: string, searchPlaces: (q: QlooPlaceQuery) => Promise<QlooResult>) {
    return requestStretchPlan({
      city,
      nights: 3,
      trip: { ...trip, city, destination: city },
      transactions: [],
      pockets,
      culturalProfile: consented,
      searchPlaces,
      now,
    });
  }

  it("sends the trip city to Qloo for Medellín, Singapore, Chiang Mai and Lima", async () => {
    for (const city of ["Medellín", "Singapore", "Chiang Mai", "Lima"]) {
      resetStretchPlanCache();
      const searchPlaces = vi.fn(async function (query: QlooPlaceQuery) {
        expect(query.city).toBe(city);
        expect(query.take).toBe(10);
        return live([
          qlooPlace(city + "-1", city + " One", 1, 4),
          qlooPlace(city + "-2", city + " Two", 2, 2),
          qlooPlace(city + "-3", city + " Three", 3, 1),
        ]);
      });
      const result = await runCity(city, searchPlaces);
      expect(result.kind).toBe("ready");
      if (result.kind === "ready") expect(result.city).toBe(city);
      expect(searchPlaces).toHaveBeenCalledTimes(1);
    }
  });

  it("does not query Qloo without consent", async () => {
    const searchPlaces = vi.fn();
    const result = await requestStretchPlan({
      city: "Lima",
      trip,
      transactions: [],
      pockets,
      culturalProfile: { ...consented, consent: { granted: false, grantedAt: null } },
      searchPlaces,
      now,
    });
    expect(result.kind).toBe("needs_consent");
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("stays honest when Qloo is down or returns nothing", async () => {
    const down = await requestStretchPlan({
      city: "Lima",
      trip,
      transactions: [],
      pockets,
      culturalProfile: consented,
      searchPlaces: async function () {
        return { source: "unavailable", places: [], reason: "QLOO_NETWORK" };
      },
      now,
    });
    expect(down.kind).toBe("unavailable");

    resetStretchPlanCache();
    const empty = await requestStretchPlan({
      city: "Lima",
      trip,
      transactions: [],
      pockets,
      culturalProfile: consented,
      searchPlaces: async function () {
        return { source: "qloo", places: [] };
      },
      now,
    });
    expect(empty.kind).toBe("empty");

    resetStretchPlanCache();
    const demo = await requestStretchPlan({
      city: "Lima",
      trip,
      transactions: [],
      pockets,
      culturalProfile: consented,
      searchPlaces: async function () {
        return {
          source: "demo",
          places: [qlooPlace("demo-1", "Other city", 1)],
          reason: "NO_KEY",
        };
      },
      now,
    });
    expect(demo.kind).toBe("unavailable");
  });
});

describe("demo clock", () => {
  it("keeps Medellín savings identical at 17:11, 22:47 UTC and 00:02", () => {
    const demoTrip: Trip = {
      ...trip,
      id: "demo-trip-medellin",
      city: "Medellín",
      destination: "Medellín, Colombia",
      baseCurrency: "USD",
      initialBudget: 1200,
    };
    const clocks = [
      new Date("2026-10-21T17:11:00-05:00"),
      new Date("2026-10-21T22:47:00.000Z"),
      new Date("2026-10-22T00:02:00-05:00"),
    ];
    const days = clocks.map(function (clock) {
      const aligned = prepareDemoBudgetContext(demoTrip, clock);
      const result = assemble(pool, 3, aligned.trip, aligned.now);
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") return null;
      return {
        days: result.daysEquivalent,
        savings: result.savingsUsd,
        remaining: result.remainingDays,
      };
    });
    expect(days[0]).toEqual(days[1]);
    expect(days[1]).toEqual(days[2]);
    expect(days[0]?.remaining).toBe(12);
    const aligned = prepareDemoBudgetContext(demoTrip, clocks[0]);
    expect(
      daysEquivalentFromSavings(180, snapshotFor(aligned.trip, aligned.now), "USD")
    ).toBe(days[0]?.days);
  });
});
