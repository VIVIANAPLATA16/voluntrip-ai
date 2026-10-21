import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBudgetSnapshot, remainingTripDays } from "@/lib/finance/budget";
import { prepareDemoBudgetContext } from "@/lib/demo/remainingDays";
import { createMedellinDemoData, createSingaporeDemoData } from "@/lib/demo/sampleData";
import { attachAffordSimulation } from "./affordSimulation";
import { buildNaviResponse } from "./responseBuilder";
import { executeTool } from "./tools";
import type { Trip } from "@/types";

const BOGOTA_NOON_ISO = "2026-10-21T17:00:00.000Z";
const UTC_1747_BOGOTA = "2026-10-21T22:47:00.000Z";
const UTC_DAWN = "2026-10-22T00:02:00.000Z";

function withTZ(tz: string, run: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

function bogotaShapedMedellin(): ReturnType<typeof createMedellinDemoData> {
  const demo = createMedellinDemoData(new Date(BOGOTA_NOON_ISO));
  return {
    ...demo,
    trip: {
      ...demo.trip,
      startDate: "2026-10-21",
      endDate: "2026-11-02",
    },
  };
}

function expectMedellinSixty(sim: unknown) {
  expect(sim).toMatchObject({
    dailyBudgetBefore: 35.67,
    dailyBudgetAfter: 30.67,
    weeklyBudgetBefore: 249.67,
    weeklyBudgetAfter: 214.67,
  });
}

describe("UTC server vs Bogotá-shaped demo dates (PR #12 production miss)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("documents the +1 day when UTC evaluates the Bogotá endDate without aligning", () => {
    withTZ("UTC", function () {
      expect(remainingTripDays({ endDate: "2026-11-02" } as Trip, new Date(UTC_1747_BOGOTA))).toBe(
        13
      );
    });
    withTZ("America/Bogota", function () {
      expect(remainingTripDays({ endDate: "2026-11-02" } as Trip, new Date(BOGOTA_NOON_ISO))).toBe(
        12
      );
    });
  });

  it.each([
    ["UTC", UTC_1747_BOGOTA],
    ["UTC", UTC_DAWN],
    ["America/Bogota", UTC_1747_BOGOTA],
  ] as const)(
    "%s at %s: dashboard and NAVI tools stay at 12 days / $35.67 → $30.67",
    function (tz, instant) {
      withTZ(tz, function () {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(instant));
        const demo = bogotaShapedMedellin();
        const prepared = prepareDemoBudgetContext(demo.trip, instant);
        const snap = buildBudgetSnapshot(
          prepared.trip,
          demo.transactions,
          demo.pockets,
          prepared.now
        );
        expect(snap.daysRemaining).toBe(12);
        expect(snap.dailySafeSpend).toBe(35.67);
        expect(snap.weeklySafeSpend).toBe(249.67);

        const ctx = {
          trip: demo.trip,
          pockets: demo.pockets,
          transactions: demo.transactions,
          goals: demo.goals,
          locale: "en" as const,
          now: instant,
        };
        const daily = executeTool("getDailyBudget", {}, ctx);
        expect(daily.data).toMatchObject({ daysRemaining: 12, dailySafeSpend: 35.67 });
        const sim = executeTool("simulatePurchase", { amount: 60, currency: "USD" }, ctx);
        expectMedellinSixty(sim.data);
      });
    }
  );

  it.each([
    ["UTC", UTC_1747_BOGOTA],
    ["America/Bogota", UTC_1747_BOGOTA],
  ] as const)("%s Singapore stays 9 days and $200.00", function (tz, instant) {
    withTZ(tz, function () {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(instant));
      const demo = createSingaporeDemoData();
      const ctx = {
        trip: demo.trip,
        pockets: demo.pockets,
        transactions: demo.transactions,
        goals: demo.goals,
        locale: "en" as const,
        now: instant,
      };
      const daily = executeTool("getDailyBudget", {}, ctx);
      expect(daily.data).toMatchObject({ daysRemaining: 9, dailySafeSpend: 200 });
    });
  });

  it("rewrites Azure prose from the same simulation object as the Confirm card", () => {
    withTZ("UTC", function () {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(UTC_1747_BOGOTA));
      const demo = bogotaShapedMedellin();
      const ctx = {
        trip: demo.trip,
        pockets: demo.pockets,
        transactions: demo.transactions,
        goals: demo.goals,
        locale: "en" as const,
        now: BOGOTA_NOON_ISO,
      };
      const azureText =
        "Daily budget: from **$32.92** to **$28.31**. Weekly: from $230.46 to $198.15. Would you like to confirm this expense?";
      const bare = buildNaviResponse({
        userText: "What if I spend $60?",
        assistantContent: azureText,
        executedTools: [],
        locale: "en",
      });
      const attached = attachAffordSimulation("What if I spend $60?", ctx, bare);
      expectMedellinSixty(attached.simulation);
      expect(attached.message.content).toContain("$35.67");
      expect(attached.message.content).toContain("$30.67");
      expect(attached.message.content).toContain("$249.67");
      expect(attached.message.content).toContain("$214.67");
      expect(attached.message.content).not.toContain("32.92");
      expect(attached.message.content).not.toContain("230.46");
    });
  });
});
