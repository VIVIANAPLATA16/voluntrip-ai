import { describe, expect, it, vi } from "vitest";
import type { Pocket, Transaction, Trip } from "@/types";
import type { QlooPlace, QlooResult } from "@/lib/qloo/types";
import {
  CATEGORY_ESTIMATE_USD,
  PRICE_LEVEL_USD,
  discoverExperiences,
  estimateExperienceCost,
  financialFit,
  getMedellinBaseline,
  rankExperiences,
  rankMedellinBaseline,
} from "./index";
import { buildBudgetSnapshot } from "@/lib/finance/budget";

const SALSA = "urn:tag:genre:music:salsa";
const NIGHTLIFE = "urn:tag:genre:place:nightlife";
const JAPANESE = "urn:tag:genre:place:restaurant:japanese";
const PROFILE_TAGS = [SALSA, NIGHTLIFE];

const now = new Date("2026-10-19T12:00:00.000Z");

const trip: Trip = {
  id: "t-med",
  destination: "Medellín, Colombia",
  city: "Medellín",
  country: "Colombia",
  countryCode: "CO",
  flag: "🇨🇴",
  baseCurrency: "USD",
  localCurrency: "COP",
  startDate: "2026-10-01",
  endDate: "2026-10-21",
  initialBudget: 5000,
  includedBenefits: ["accommodation"],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const pockets: Pocket[] = [
  {
    id: "pk-emergency",
    tripId: "t-med",
    name: "Emergency",
    category: "emergency",
    balance: 200,
    allocated: 200,
    protected: true,
    icon: "shield",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [];

const tightTrip: Trip = { ...trip, initialBudget: 220 };
const tightPockets: Pocket[] = [
  {
    ...pockets[0],
    balance: 180,
    allocated: 180,
  },
];

function place(partial: Partial<QlooPlace> & Pick<QlooPlace, "id" | "name" | "rank">): QlooPlace {
  return {
    tags: [],
    popularity: 0.5,
    priceLevel: 2,
    ...partial,
  };
}

function qlooResult(places: QlooPlace[]): Extract<QlooResult, { source: "qloo" }> {
  return { source: "qloo", places };
}

function rankOn(places: QlooPlace[], finance = { trip, transactions, pockets }) {
  return rankExperiences({
    candidates: places,
    source: "qloo",
    queriedAt: now.toISOString(),
    qlooTotal: places.length,
    profileTagIds: PROFILE_TAGS,
    intent: "tonight",
    now,
    ...finance,
  });
}

describe("estimateExperienceCost", () => {
  it("maps price_level bands in USD and always marks isEstimate", () => {
    expect(estimateExperienceCost(place({ id: "p1", name: "A", rank: 1, priceLevel: 1 }))).toEqual({
      amount: PRICE_LEVEL_USD[1],
      basis: "price_level",
      isEstimate: true,
    });
    expect(estimateExperienceCost(place({ id: "p2", name: "B", rank: 1, priceLevel: 4 })).amount).toBe(
      PRICE_LEVEL_USD[4]
    );
  });

  it("uses category estimates when price_level is null and marks isEstimate", () => {
    const nightlife = estimateExperienceCost(
      place({
        id: "n",
        name: "Club",
        rank: 1,
        priceLevel: null,
        tags: [{ id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" }],
      })
    );
    expect(nightlife).toEqual({
      amount: CATEGORY_ESTIMATE_USD.nightlife,
      basis: "category",
      isEstimate: true,
    });

    const cafe = estimateExperienceCost(
      place({
        id: "c",
        name: "Café",
        rank: 1,
        priceLevel: null,
        tags: [{ id: "urn:tag:category:place:cafe", name: "Café", type: "urn:tag:category:place" }],
      })
    );
    expect(cafe).toEqual({
      amount: CATEGORY_ESTIMATE_USD.cafe,
      basis: "category",
      isEstimate: true,
    });

    const other = estimateExperienceCost(
      place({
        id: "o",
        name: "Unknown",
        rank: 1,
        priceLevel: null,
        tags: [{ id: "urn:tag:genre:place:local", name: "Local", type: "urn:tag:genre:place" }],
      })
    );
    expect(other).toEqual({
      amount: CATEGORY_ESTIMATE_USD.other,
      basis: "default",
      isEstimate: true,
    });
  });

  it("treats restaurant tags as the restaurant band when price_level is null", () => {
    const estimate = estimateExperienceCost(
      place({
        id: "sushi",
        name: "Sushi",
        rank: 1,
        priceLevel: null,
        tags: [{ id: JAPANESE, name: "Japanese", type: "urn:tag:genre:place" }],
      })
    );
    expect(estimate.amount).toBe(CATEGORY_ESTIMATE_USD.restaurant);
    expect(estimate.basis).toBe("category");
    expect(estimate.isEstimate).toBe(true);
  });
});

describe("discoverExperiences", () => {
  it("requests take=10, strips hotels, and preserves source", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([
        place({
          id: "club",
          name: "El Social Salsa",
          rank: 1,
          tags: [{ id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "hotel-1",
          name: "Hotel Parque 10",
          rank: 2,
          tags: [{ id: "urn:tag:genre:place:hotel", name: "Hotel", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "hotel-2",
          name: "Boutique stay",
          rank: 3,
          tags: [
            {
              id: "urn:tag:category:place:hotel:boutique",
              name: "Boutique hotel",
              type: "urn:tag:category:place",
            },
          ],
        }),
      ])
    );

    const result = await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: true },
      { searchPlaces, now }
    );

    expect(searchPlaces).toHaveBeenCalledWith({
      city: "Medellín",
      tags: [SALSA, NIGHTLIFE],
      take: 10,
    });
    expect(result.source).toBe("qloo");
    expect(result.candidates.map((c) => c.id)).toEqual(["club"]);
    expect(result.qlooTotal).toBe(3);
  });

  it("does not send profile tags without consent", async () => {
    const searchPlaces = vi.fn(async () => qlooResult([]));
    await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: false },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({ city: "Medellín", tags: [], take: 10 });
  });

  it("never labels demo or unavailable results as qloo", async () => {
    const demo = await discoverExperiences(
      { city: "Medellín", profileTagIds: [], consentGranted: false },
      {
        now,
        searchPlaces: async () => ({
          source: "demo",
          reason: "NO_KEY",
          places: [
            place({
              id: "demo-1",
              name: "Demo café",
              rank: 1,
              tags: [{ id: "urn:tag:category:place:cafe", name: "Café", type: "urn:tag:category:place" }],
            }),
          ],
        }),
      }
    );
    expect(demo.source).toBe("demo");
    expect(demo.candidates[0]?.id).toBe("demo-1");

    const unavailable = await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: true },
      {
        now,
        searchPlaces: async () => ({
          source: "unavailable",
          places: [],
          reason: "QLOO_NETWORK",
        }),
      }
    );
    expect(unavailable.source).toBe("unavailable");
    expect(unavailable.candidates).toEqual([]);
  });
});

describe("ranking and Voluntrip Value Score", () => {
  const salsaNight = place({
    id: "el-social-salsa",
    name: "El Social Salsa",
    rank: 1,
    priceLevel: 3,
    tags: [
      { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
      { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
    ],
  });
  const cheaperSalsa = place({
    id: "barrio-salsa",
    name: "Barrio Salsa",
    rank: 2,
    priceLevel: 1,
    tags: [
      { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
      { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
    ],
  });
  const unmatchedPark = place({
    id: "random-park",
    name: "Random park",
    rank: 3,
    priceLevel: 1,
    tags: [{ id: "urn:tag:genre:place:park", name: "Park", type: "urn:tag:genre:place" }],
  });

  it("Qloo ON top differs from Qloo OFF baseline with the same snapshot", () => {
    const snapshotOn = buildBudgetSnapshot(trip, transactions, pockets, now);
    const snapshotOff = buildBudgetSnapshot(trip, transactions, pockets, now);
    expect(snapshotOn).toEqual(snapshotOff);

    const on = rankOn([salsaNight, cheaperSalsa, unmatchedPark]);
    const off = rankMedellinBaseline({
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });

    expect(on.best).not.toBeNull();
    expect(off.best).not.toBeNull();
    expect(on.best?.id).not.toBe(off.best?.id);
    expect(on.best?.source).toBe("qloo");
    expect(off.best?.source).toBe("demo");
    expect(off.all.every((item) => item.source === "demo")).toBe(true);
    expect(off.all.every((item) => item.culturalFit === 0)).toBe(true);
    expect(off.all.every((item) => item.whyQloo.source !== "qloo")).toBe(true);
  });

  it("gives financialFit 0 when cost exceeds real available money and never picks it as best", () => {
    const expensive = place({
      id: "pricey-club",
      name: "Pricey Club",
      rank: 1,
      priceLevel: 4,
      tags: [
        { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
        { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
      ],
    });
    const affordable = place({
      id: "cheap-cafe",
      name: "Cheap café",
      rank: 2,
      priceLevel: 1,
      tags: [{ id: "urn:tag:category:place:cafe", name: "Café", type: "urn:tag:category:place" }],
    });

    const snapshot = buildBudgetSnapshot(tightTrip, transactions, tightPockets, now);
    expect(snapshot.realAvailable).toBeLessThan(PRICE_LEVEL_USD[4]);

    const fit = financialFit(PRICE_LEVEL_USD[4], snapshot, {
      trip: tightTrip,
      transactions,
      pockets: tightPockets,
      now,
    });
    expect(fit).toBe(0);

    const ranked = rankOn([expensive, affordable], {
      trip: tightTrip,
      transactions,
      pockets: tightPockets,
    });
    expect(ranked.all.find((item) => item.id === "pricey-club")?.financialFit).toBe(0);
    expect(ranked.best?.id).not.toBe("pricey-club");
    expect(ranked.best?.id).toBe("cheap-cafe");
    expect(ranked.best?.financialFit).toBeGreaterThan(0);
  });

  it("picks a cheaper alternative with culturalFit >= 60, or null", () => {
    const withAlternative = rankOn([salsaNight, cheaperSalsa, unmatchedPark]);
    expect(withAlternative.best?.id).toBe("el-social-salsa");
    expect(withAlternative.alternative?.id).toBe("barrio-salsa");
    expect(withAlternative.alternative).not.toBeNull();
    expect(withAlternative.alternative!.estimatedCost.amount).toBeLessThan(
      withAlternative.best!.estimatedCost.amount
    );
    expect(withAlternative.alternative!.culturalFit).toBeGreaterThanOrEqual(60);

    const onlyBestFits = rankOn([salsaNight, unmatchedPark]);
    expect(onlyBestFits.best?.id).toBe("el-social-salsa");
    expect(onlyBestFits.alternative).toBeNull();
  });

  it("keeps demo/unavailable/baseline off the qloo source", () => {
    const demoRanked = rankExperiences({
      candidates: [
        place({
          id: "demo-cafe",
          name: "Demo café",
          rank: 1,
          tags: [{ id: SALSA, name: "Salsa", type: "urn:tag:genre:music" }],
        }),
      ],
      source: "demo",
      queriedAt: now.toISOString(),
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });
    expect(demoRanked.all[0]?.source).toBe("demo");
    expect(demoRanked.all[0]?.culturalFit).toBe(0);
    expect(demoRanked.all[0]?.whyQloo.source).toBe("demo");

    const unavailable = rankExperiences({
      candidates: [],
      source: "unavailable",
      queriedAt: now.toISOString(),
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });
    expect(unavailable.best).toBeNull();
    expect(unavailable.all).toEqual([]);

    const baseline = getMedellinBaseline(now);
    expect(baseline.source).toBe("demo");
    expect(baseline.label).toBe("generic, not from Qloo");
    expect(baseline.candidates.every((item) => !item.id.startsWith("urn:"))).toBe(true);
  });

  it("separates Qloo evidence from Voluntrip evidence", () => {
    const ranked = rankOn([salsaNight]);
    const best = ranked.best!;
    expect(best.whyQloo).toMatchObject({
      matchedTags: expect.arrayContaining([SALSA, NIGHTLIFE]),
      rank: 1,
      source: "qloo",
      queriedAt: now.toISOString(),
    });
    expect(best.whyVoluntrip.estimatedCost.isEstimate).toBe(true);
    expect(best.whyVoluntrip.protectedMoneyUntouched).toBe(true);
    expect(best.whyVoluntrip.dailySafeSpendAfter).toBeLessThanOrEqual(
      best.whyVoluntrip.dailySafeSpendBefore
    );
    expect(["on_track", "careful", "at_risk"]).toContain(best.whyVoluntrip.runwayStatus);
  });
});
