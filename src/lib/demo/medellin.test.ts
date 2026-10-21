import { afterEach, describe, expect, it, vi } from "vitest";
import { convertCurrency } from "@/lib/finance/currency";
import { buildBudgetSnapshot } from "@/lib/finance/budget";
import { createDemoData, createMedellinDemoData, createSingaporeDemoData } from "./sampleData";
import { demoBudgetNow, refreshDemoTripDates } from "./remainingDays";

const CLOCKS = [
  new Date(2026, 5, 15, 0, 2, 0, 0),
  new Date(2026, 11, 15, 16, 50, 0, 0),
] as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("Medellín demo trip", () => {
  it.each(CLOCKS)("keeps $428, 12 days and $35.67/day at %s", (when) => {
    vi.useFakeTimers();
    vi.setSystemTime(when);
    const demo = createMedellinDemoData();
    expect(demo.trip.city).toBe("Medellín");
    expect(demo.trip.country).toBe("Colombia");
    expect(demo.trip.initialBudget).toBe(978);
    expect(demo.transactions).toEqual([]);
    expect(demo.pockets.filter((p) => p.protected).map((p) => p.balance)).toEqual([300, 250]);

    const snap = buildBudgetSnapshot(demo.trip, demo.transactions, demo.pockets);
    expect(snap.realAvailable).toBe(428);
    expect(snap.protectedMoney).toBe(550);
    expect(snap.daysRemaining).toBe(12);
    expect(snap.dailySafeSpend).toBe(35.67);
    expect(snap.weeklySafeSpend).toBe(249.67);
  });

  it("refreshes remaining days after midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 14, 16, 50, 0, 0));
    const loaded = createMedellinDemoData();
    expect(buildBudgetSnapshot(loaded.trip, loaded.transactions, loaded.pockets).daysRemaining).toBe(12);
    vi.setSystemTime(new Date(2026, 5, 15, 0, 2, 0, 0));
    const refreshed = refreshDemoTripDates(loaded.trip);
    const snap = buildBudgetSnapshot(refreshed, loaded.transactions, loaded.pockets);
    expect(snap.daysRemaining).toBe(12);
    expect(snap.realAvailable).toBe(428);
    expect(snap.dailySafeSpend).toBe(35.67);
  });

  it("keeps 12 days at 00:02 when DST would skip a calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 0, 2, 0, 0));
    const demo = createMedellinDemoData();
    const snap = buildBudgetSnapshot(demo.trip, demo.transactions, demo.pockets, demoBudgetNow());
    expect(snap.daysRemaining).toBe(12);
    expect(snap.realAvailable).toBe(428);
    expect(snap.dailySafeSpend).toBe(35.67);
    expect(snap.weeklySafeSpend).toBe(249.67);
  });

  it("keeps the Chiang Mai demo separate", () => {
    const chiang = createDemoData();
    expect(chiang.trip.city).toBe("Chiang Mai");
    expect(chiang.trip.initialBudget).toBe(1500);
    expect(chiang.transactions.length).toBeGreaterThan(0);
  });
});

describe("Singapore demo trip", () => {
  it.each(CLOCKS)("keeps $1800, 9 days and $200/day at %s", (when) => {
    vi.useFakeTimers();
    vi.setSystemTime(when);
    const demo = createSingaporeDemoData();
    expect(demo.trip.city).toBe("Singapore");
    expect(demo.trip.country).toBe("Singapore");
    expect(demo.trip.countryCode).toBe("SG");
    expect(demo.trip.baseCurrency).toBe("USD");
    expect(demo.trip.localCurrency).toBe("SGD");
    expect(demo.trip.initialBudget).toBe(2900);
    expect(demo.transactions).toEqual([]);
    expect(demo.pockets.every((p) => p.protected)).toBe(true);
    expect(demo.pockets.map((p) => p.balance)).toEqual([600, 500]);
    expect(convertCurrency(demo.trip.initialBudget, "USD", "SGD")).toBeCloseTo(2900 * 1.34);

    const snap = buildBudgetSnapshot(demo.trip, demo.transactions, demo.pockets);
    expect(snap.realAvailable).toBe(1800);
    expect(snap.protectedMoney).toBe(1100);
    expect(snap.daysRemaining).toBe(9);
    expect(snap.dailySafeSpend).toBe(200);
    expect(snap.weeklySafeSpend).toBe(1400);
  });
});
