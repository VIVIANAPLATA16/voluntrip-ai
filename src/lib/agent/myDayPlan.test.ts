import { describe, expect, it } from "vitest";
import type { Experience } from "@/lib/experiences";
import { formatMoney } from "@/lib/constants";
import { t } from "@/lib/i18n/dictionaries";
import type { PurchaseSimulation } from "@/types";
import {
  dayPlanConcept,
  dayPlanTotal,
  distinctByFoldedName,
  formatMyDayReply,
  matchingDayPlanConcept,
  pickDayStops,
  type MyDayPlan,
} from "./myDayPlan";

const ENTITY_UUID = "550e8400-e29b-41d4-a716-446655440000";

function place(partial: {
  name: string;
  cost: number;
  rank?: number;
  entities?: string[];
  matchedTags?: string[];
  signals?: string[];
}): Experience {
  return {
    id: partial.name,
    name: partial.name,
    tags: [],
    popularity: 0.5,
    priceLevel: 2,
    source: "qloo",
    estimatedCost: { amount: partial.cost, basis: "price_level", isEstimate: true },
    culturalFit: 80,
    financialFit: 70,
    contextFit: 50,
    valueScore: 72,
    whyQloo: {
      matchedTags: partial.matchedTags ?? ["urn:tag:genre:music:salsa"],
      rank: partial.rank ?? 1,
      source: "qloo",
      queriedAt: "2026-10-19T12:00:00.000Z",
      signals: partial.signals ?? ["salsa"],
      totalResults: 10,
      entities: partial.entities,
    },
    whyVoluntrip: {
      estimatedCost: { amount: partial.cost, basis: "price_level", isEstimate: true },
      dailySafeSpendBefore: 80,
      dailySafeSpendAfter: 20,
      protectedMoneyUntouched: true,
      runwayStatus: "on_track",
    },
  };
}

function simulation(amount: number): PurchaseSimulation {
  return {
    purchaseAmount: amount,
    purchaseCurrency: "USD",
    purchaseAmountBase: amount,
    availableBefore: 200,
    availableAfter: 200 - amount,
    dailyBudgetBefore: 80,
    dailyBudgetAfter: 80 - amount / 3,
    weeklyBudgetBefore: 560,
    weeklyBudgetAfter: 560 - amount,
    affordable: true,
    impactMessage: "ok",
    daysImpacted: 0,
  };
}

describe("pickDayStops", () => {
  const ranked = [
    place({ name: "Uno", cost: 20, rank: 1 }),
    place({ name: "Dos", cost: 20, rank: 2 }),
    place({ name: "Tres", cost: 20, rank: 3 }),
    place({ name: "Uno ", cost: 8, rank: 4 }),
  ];

  it("fills 3 unique names that fit daily safe and drops folded duplicates", () => {
    const picked = pickDayStops(ranked, 80);
    expect(picked.map((stop) => stop.name)).toEqual(["Uno", "Dos", "Tres"]);
    expect(dayPlanTotal(picked)).toBe(60);
  });

  it("returns 2 or 1 when that is all that fits", () => {
    expect(pickDayStops(ranked, 45).map((stop) => stop.name)).toEqual(["Uno", "Dos"]);
    expect(pickDayStops(ranked, 25).map((stop) => stop.name)).toEqual(["Uno"]);
  });

  it("returns none when nothing fits", () => {
    expect(pickDayStops(ranked, 5)).toEqual([]);
  });
});

describe("distinctByFoldedName", () => {
  it("keeps the first of the same folded name", () => {
    const unique = distinctByFoldedName([
      place({ name: "Café Dos", cost: 20 }),
      place({ name: "Cafe Dos", cost: 8 }),
      place({ name: "Bar Tres", cost: 20 }),
    ]);
    expect(unique.map((stop) => stop.name)).toEqual(["Café Dos", "Bar Tres"]);
  });
});

describe("formatMyDayReply", () => {
  const stops = [
    place({ name: "El Social Salsa", cost: 20, rank: 1, entities: ["Bad Bunny"] }),
    place({ name: "Cafe Dos", cost: 20, rank: 2, entities: ["Bad Bunny"] }),
    place({ name: "Bar Tres", cost: 20, rank: 3, entities: ["Bad Bunny"] }),
  ];
  const ready: MyDayPlan = {
    kind: "ready",
    city: "Medellín",
    stops,
    total: 60,
    dailySafe: 80,
    simulation: simulation(60),
    concept: dayPlanConcept("en", stops),
  };

  it("copies simulatePurchase totals and never emits entity UUIDs", () => {
    const en = formatMyDayReply("en", ready);
    expect(en).toContain(formatMoney(60, "USD", { showCode: true }));
    expect(en).toContain(formatMoney(ready.simulation.dailyBudgetBefore, "USD"));
    expect(en).toContain(formatMoney(ready.simulation.dailyBudgetAfter, "USD"));
    expect(en).toContain("El Social Salsa");
    expect(en).toContain("Bad Bunny");
    expect(en).toMatch(/Source: qloo/);
    expect(en).not.toContain(ENTITY_UUID);
    expect(en.split("\n").length).toBeLessThanOrEqual(8);
    expect(matchingDayPlanConcept(ready, 60)).toBe("Today's plan: El Social Salsa, Cafe Dos, Bar Tres");
  });

  it("says when only 2 or 1 stop fits, and invents nothing when none fit", () => {
    const two = formatMyDayReply("en", { ...ready, stops: stops.slice(0, 2) });
    expect(two).toMatch(/Only 2 stops/);
    const one = formatMyDayReply("en", { ...ready, stops: stops.slice(0, 1) });
    expect(one).toMatch(/Only 1 stop/);
    const none = formatMyDayReply("en", {
      kind: "none_fit",
      city: "Lima",
      dailySafe: 10,
      currency: "USD",
    });
    expect(none).toMatch(/will not invent/);
    expect(none).not.toMatch(/1\. /);
    expect(none).not.toMatch(/Source: qloo/);
  });

  it("uses Fuente/Fonte for qloo in es and pt, never Source", () => {
    const es = formatMyDayReply("es", {
      ...ready,
      concept: dayPlanConcept("es", stops),
    });
    const pt = formatMyDayReply("pt", {
      ...ready,
      concept: dayPlanConcept("pt", stops),
    });
    expect(es).toMatch(/Fuente: qloo/);
    expect(es).not.toMatch(/Source: qloo/);
    expect(pt).toMatch(/Fonte: qloo/);
    expect(pt).not.toMatch(/Source: qloo/);
    expect(dayPlanConcept("es", stops)).toBe(
      "Plan de hoy: El Social Salsa, Cafe Dos, Bar Tres"
    );
    expect(t("es", "navi.myday.concept", { stops: "A, B" })).toBe("Plan de hoy: A, B");
    expect(t("es", "navi.quick.myday")).toBe("Plan para hoy");
    expect(t("en", "navi.quick.myday")).toBe("Plan for today");
    expect(t("pt", "navi.quick.myday")).toBe("Plano para hoje");
    expect(t("es", "navi.quick_prompt.myday")).toBe("plan para hoy");
    expect(t("en", "navi.quick_prompt.myday")).toBe("plan for today");
    expect(t("pt", "navi.quick_prompt.myday")).toBe("plano para hoje");
  });

  it("does not claim tag matches when only loved entities were sent", () => {
    const lovedOnly = [
      place({
        name: "Barranco Jazz",
        cost: 20,
        rank: 2,
        matchedTags: [],
        signals: [],
        entities: ["Bad Bunny"],
      }),
    ];
    const text = formatMyDayReply("en", {
      ...ready,
      stops: lovedOnly,
    });
    expect(text).toMatch(/loved entities/);
    expect(text).toContain("Bad Bunny");
    expect(text).not.toMatch(/Matched tags/);
    expect(text).not.toContain(ENTITY_UUID);
  });
});
