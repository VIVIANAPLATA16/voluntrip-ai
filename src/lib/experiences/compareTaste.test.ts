import { afterEach, describe, expect, it, vi } from "vitest";
import type { CulturalProfile, Pocket, Trip } from "@/types";
import type { QlooPlace, QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import {
  compareTaste,
  countChangedPlaces,
  normalizePlaceKey,
  resetCompareTasteCache,
} from "./compareTaste";

const SALSA = "urn:tag:genre:music:salsa";

const now = new Date("2026-10-19T12:00:00.000Z");

const trip: Trip = {
  id: "t-any",
  destination: "Lima, Peru",
  city: "Lima",
  country: "Peru",
  countryCode: "PE",
  flag: "🇵🇪",
  baseCurrency: "USD",
  localCurrency: "PEN",
  startDate: "2026-10-01",
  endDate: "2026-10-21",
  initialBudget: 5000,
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

const noConsent: CulturalProfile = {
  ...consented,
  consent: { granted: false, grantedAt: null },
};

function place(id: string, name: string, rank: number): QlooPlace {
  return {
    id,
    name,
    rank,
    tags: [{ id: SALSA, name: "Salsa", type: "urn:tag:genre:music" }],
    popularity: 0.5,
    priceLevel: 2,
  };
}

function qloo(places: QlooPlace[]): Extract<QlooResult, { source: "qloo" }> {
  return { source: "qloo", places };
}

function input(
  city: string,
  searchPlaces: (query: QlooPlaceQuery) => Promise<QlooResult>,
  profile: CulturalProfile | null = consented
) {
  return {
    city,
    trip: { ...trip, city, destination: city },
    transactions: [],
    pockets,
    culturalProfile: profile,
    searchPlaces,
    now,
  };
}

afterEach(function () {
  resetCompareTasteCache();
});

describe("normalizePlaceKey and countChangedPlaces", () => {
  it("treats the same id as unchanged even if the name differs", () => {
    expect(normalizePlaceKey({ id: "ABC", name: "One" })).toBe("id:abc");
    expect(
      countChangedPlaces(
        [place("a", "Alpha", 1), place("b", "Beta", 2), place("c", "Gamma", 3)],
        [place("a", "Alpha remix", 1), place("b", "Beta", 2), place("c", "Gamma", 3)]
      )
    ).toBe(0);
  });

  it("counts 1 and 3 replacements in the top 3", () => {
    const base = [place("a", "A", 1), place("b", "B", 2), place("c", "C", 3)];
    expect(countChangedPlaces(base, [place("a", "A", 1), place("b", "B", 2), place("d", "D", 3)])).toBe(
      1
    );
    expect(countChangedPlaces(base, [place("x", "X", 1), place("y", "Y", 2), place("z", "Z", 3)])).toBe(
      3
    );
  });

  it("falls back to a normalized name when entity id is empty", () => {
    expect(
      countChangedPlaces(
        [
          { id: "", name: "Alpha Cafe" },
          { id: "", name: "Beta" },
          { id: "", name: "Gamma" },
        ],
        [
          { id: "", name: "alpha  cafe" },
          { id: "", name: "Beta" },
          { id: "", name: "Delta" },
        ]
      )
    ).toBe(1);
  });
});

describe("compareTaste", () => {
  it("does not query Qloo without consent or likes", async () => {
    const searchPlaces = vi.fn();
    const none = await compareTaste(input("Lima", searchPlaces, noConsent));
    expect(none.kind).toBe("needs_consent");
    expect(searchPlaces).not.toHaveBeenCalled();

    const emptyLikes: CulturalProfile = {
      ...consented,
      music: [],
    };
    const skipped = await compareTaste(input("Singapore", searchPlaces, emptyLikes));
    expect(skipped.kind).toBe("needs_consent");
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("runs the same city twice in parallel and reports 0 / 1 / 3 changes", async () => {
    const left = [place("a", "A", 1), place("b", "B", 2), place("c", "C", 3)];
    const rightSame = left;
    const rightOne = [place("a", "A", 1), place("b", "B", 2), place("d", "D", 3)];
    const rightAll = [place("x", "X", 1), place("y", "Y", 2), place("z", "Z", 3)];

    async function run(city: string, withPlaces: QlooPlace[]) {
      resetCompareTasteCache();
      const searchPlaces = vi.fn(async function (query: QlooPlaceQuery) {
        if (!query.tags || query.tags.length === 0) return qloo(left);
        return qloo(withPlaces);
      });
      const result = await compareTaste(input(city, searchPlaces));
      expect(searchPlaces).toHaveBeenCalledTimes(2);
      expect(searchPlaces.mock.calls[0][0].city).toBe(city);
      expect(searchPlaces.mock.calls[1][0].city).toBe(city);
      expect(searchPlaces).toHaveBeenCalledWith({ city, tags: [], take: 10 });
      expect(searchPlaces).toHaveBeenCalledWith({ city, tags: [SALSA], take: 10 });
      return result;
    }

    const zero = await run("Medellín", rightSame);
    expect(zero.kind).toBe("ready");
    if (zero.kind === "ready") {
      expect(zero.changedCount).toBe(0);
      expect(zero.without.source).toBe("qloo");
      expect(zero.withTaste.source).toBe("qloo");
      expect(zero.signals).toEqual(["salsa"]);
    }

    const one = await run("Singapore", rightOne);
    expect(one.kind === "ready" && one.changedCount).toBe(1);

    const three = await run("Lima", rightAll);
    expect(three.kind === "ready" && three.changedCount).toBe(3);
    if (three.kind === "ready") {
      expect(three.city).toBe("Lima");
    }
  });

  it("keeps an honest unavailable column when one Qloo side is down", async () => {
    const searchPlaces = vi.fn(async function (query: QlooPlaceQuery) {
      if (!query.tags || query.tags.length === 0) {
        return { source: "unavailable" as const, places: [] as [], reason: "QLOO_NETWORK" as const };
      }
      return qloo([place("a", "A", 1)]);
    });
    const result = await compareTaste(input("Lima", searchPlaces));
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.without.status).toBe("unavailable");
      expect(result.without.places).toEqual([]);
      expect(result.withTaste.status).toBe("ok");
      expect(result.changedCount).toBeNull();
    }
  });

  it("reports an empty Qloo column without inventing places", async () => {
    const searchPlaces = vi.fn(async function (query: QlooPlaceQuery) {
      if (!query.tags || query.tags.length === 0) return qloo([]);
      return qloo([place("a", "A", 1)]);
    });
    const result = await compareTaste(input("Chiang Mai", searchPlaces));
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.without.status).toBe("empty");
      expect(result.without.source).toBe("qloo");
      expect(result.without.places).toEqual([]);
      expect(result.withTaste.status).toBe("ok");
      expect(result.changedCount).toBeNull();
    }
  });

  it("does not show demo fixtures as a Qloo default ranking", async () => {
    const searchPlaces = vi.fn(async function (query: QlooPlaceQuery) {
      if (!query.tags || query.tags.length === 0) {
        return { source: "demo" as const, places: [place("demo-1", "Other city", 1)], reason: "NO_KEY" as const };
      }
      return qloo([place("a", "A", 1)]);
    });
    const result = await compareTaste(input("Lima", searchPlaces));
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.without.status).toBe("unavailable");
      expect(result.without.source).toBe("demo");
      expect(result.without.places).toEqual([]);
    }
  });

  it("caches the pair for the session by city + signals", async () => {
    const searchPlaces = vi.fn(async function () {
      return qloo([place("a", "A", 1)]);
    });
    const first = await compareTaste(input("Lima", searchPlaces));
    const second = await compareTaste(input("Lima", searchPlaces));
    expect(first).toBe(second);
    expect(searchPlaces).toHaveBeenCalledTimes(2);
    await compareTaste(input("Singapore", searchPlaces));
    expect(searchPlaces).toHaveBeenCalledTimes(4);
  });
});
