import { describe, expect, it } from "vitest";
import { buildBudgetSnapshot } from "@/lib/finance/budget";
import { createDemoData, createMedellinDemoData } from "./sampleData";

describe("Medellín demo trip", () => {
  it("is Medellín with $428 real available and 12 days remaining", () => {
    const now = new Date("2026-10-20T16:50:00-04:00");
    const demo = createMedellinDemoData(now);
    expect(demo.trip.city).toBe("Medellín");
    expect(demo.trip.country).toBe("Colombia");
    expect(demo.trip.initialBudget).toBe(978);
    expect(demo.transactions).toEqual([]);
    expect(demo.pockets.filter((p) => p.protected).map((p) => p.balance)).toEqual([300, 250]);

    const snap = buildBudgetSnapshot(demo.trip, demo.transactions, demo.pockets, now);
    expect(snap.realAvailable).toBe(428);
    expect(snap.protectedMoney).toBe(550);
    expect(snap.daysRemaining).toBe(12);
  });

  it("keeps the Chiang Mai demo separate", () => {
    const chiang = createDemoData();
    expect(chiang.trip.city).toBe("Chiang Mai");
    expect(chiang.trip.initialBudget).toBe(1500);
    expect(chiang.transactions.length).toBeGreaterThan(0);
  });
});
