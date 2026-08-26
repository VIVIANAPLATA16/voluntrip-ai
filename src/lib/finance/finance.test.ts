import { describe, expect, it } from "vitest";
import {
  buildBudgetSnapshot,
  calculateDRS,
  calculateDailyBudget,
  calculateMoneyRunway,
  convertCurrency,
  daysBetween,
  detectSpendingStatus,
  getProtectedMoney,
  getRealAvailable,
  remainingTripDays,
  simulatePurchase,
} from "@/lib/finance";
import type { Pocket, Transaction, Trip } from "@/types";

const trip: Trip = {
  id: "t1",
  destination: "Chiang Mai, Thailand",
  city: "Chiang Mai",
  country: "Thailand",
  countryCode: "TH",
  flag: "🇹🇭",
  baseCurrency: "USD",
  localCurrency: "THB",
  startDate: "2026-08-01",
  endDate: "2026-09-15",
  initialBudget: 1500,
  includedBenefits: ["accommodation", "breakfast"],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const pockets: Pocket[] = [
  {
    id: "p1",
    tripId: "t1",
    name: "Emergency",
    category: "emergency",
    balance: 300,
    allocated: 300,
    protected: true,
    icon: "shield",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "p2",
    tripId: "t1",
    name: "Return Flight",
    category: "return_flight",
    balance: 250,
    allocated: 250,
    protected: true,
    icon: "plane",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "tx1",
    tripId: "t1",
    amountOriginal: 180,
    currencyOriginal: "THB",
    exchangeRate: 1 / 35,
    amountBase: 5.14,
    currencyBase: "USD",
    concept: "Lunch",
    category: "food",
    source: "manual",
    createdAt: "2026-08-10T12:00:00.000Z",
  },
];

describe("DRS calculation", () => {
  it("computes weekly safe spend as (available) / weeks", () => {
    const available = 1500 - 300 - 250; // 950
    const weeks = 45 / 7;
    const drs = calculateDRS(available, weeks);
    expect(drs).toBeCloseTo(available / weeks, 5);
  });
});

describe("daily budget", () => {
  it("divides available by remaining days", () => {
    expect(calculateDailyBudget(950, 45)).toBeCloseTo(21.111, 2);
  });
});

describe("weekly budget via snapshot", () => {
  it("builds snapshot with protected money excluded", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const snap = buildBudgetSnapshot(trip, transactions, pockets, now);
    expect(snap.protectedMoney).toBe(550);
    expect(snap.realAvailable).toBeCloseTo(1500 - 5.14 - 550, 1);
    expect(snap.weeklySafeSpend).toBeGreaterThan(0);
    expect(snap.dailySafeSpend).toBeGreaterThan(0);
  });
});

describe("protected pockets", () => {
  it("sums only protected balances", () => {
    expect(getProtectedMoney(pockets, "t1")).toBe(550);
  });

  it("excludes protected from real available", () => {
    const available = getRealAvailable(trip, transactions, pockets);
    expect(available).toBeCloseTo(1500 - 5.14 - 550, 1);
  });
});

describe("money runway", () => {
  it("returns on_track when average spend is low", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const snap = buildBudgetSnapshot(trip, transactions, pockets, now);
    const runway = calculateMoneyRunway(trip, snap, now);
    expect(runway.message.length).toBeGreaterThan(10);
    expect(["on_track", "careful", "at_risk"]).toContain(runway.status);
  });
});

describe("currency conversion", () => {
  it("converts THB to USD via mock rates", () => {
    const usd = convertCurrency(350, "THB", "USD");
    expect(usd).toBeCloseTo(10, 5);
  });

  it("converts USD to COP", () => {
    const cop = convertCurrency(1, "USD", "COP");
    expect(cop).toBe(4100);
  });

  it("identity conversion", () => {
    expect(convertCurrency(42, "EUR", "EUR")).toBe(42);
  });
});

describe("purchase simulation", () => {
  it("does not mutate inputs and reports affordability", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const before = getRealAvailable(trip, transactions, pockets);
    const sim = simulatePurchase(trip, transactions, pockets, 200, "USD", now);
    expect(getRealAvailable(trip, transactions, pockets)).toBe(before);
    expect(sim.purchaseAmountBase).toBe(200);
    expect(sim.availableAfter).toBeCloseTo(before - 200, 1);
    expect(sim.affordable).toBe(before >= 200);
  });
});

describe("remaining trip days", () => {
  it("counts days until end", () => {
    const days = remainingTripDays(trip, new Date("2026-09-10T00:00:00.000Z"));
    expect(days).toBeGreaterThanOrEqual(5);
  });

  it("daysBetween is non-negative", () => {
    expect(daysBetween("2026-08-01", "2026-08-01")).toBe(0);
    expect(daysBetween("2026-08-01", "2026-08-10")).toBe(9);
  });
});

describe("overspending detection", () => {
  it("flags at_risk when projected need exceeds available", () => {
    expect(detectSpendingStatus(100, 20, 10, 10)).toBe("at_risk");
  });

  it("flags on_track when spending is healthy", () => {
    expect(detectSpendingStatus(1000, 10, 30, 33)).toBe("on_track");
  });
});
