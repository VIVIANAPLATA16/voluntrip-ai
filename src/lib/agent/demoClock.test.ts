import { afterEach, describe, expect, it, vi } from "vitest";
import { budgetNowForTrip } from "@/lib/demo/remainingDays";
import { createMedellinDemoData, createSingaporeDemoData } from "@/lib/demo/sampleData";
import { attachAffordSimulation } from "./affordSimulation";
import { parseNaviBold } from "./naviText";
import { buildNaviResponse } from "./responseBuilder";
import { executeTool } from "./tools";
import { runLocalAsk } from "./localAsk";

const CLOCKS = [
  new Date(2026, 9, 21, 17, 11, 0, 0),
  new Date(2026, 9, 21, 0, 2, 0, 0),
] as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("NAVI demo clock matches the dashboard", () => {
  it.each(CLOCKS)("Medellín at %s: 12 days, $35.67 then $30.67 after $60", async (when) => {
    vi.useFakeTimers();
    vi.setSystemTime(when);
    const demo = createMedellinDemoData();
    const ctx = {
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      locale: "en" as const,
    };

    const daily = executeTool("getDailyBudget", {}, ctx);
    expect(daily.ok).toBe(true);
    expect(daily.data).toMatchObject({ daysRemaining: 12, dailySafeSpend: 35.67 });

    const sim = executeTool("simulatePurchase", { amount: 60, currency: "USD" }, ctx);
    expect(sim.ok).toBe(true);
    expect(sim.data).toMatchObject({
      dailyBudgetBefore: 35.67,
      dailyBudgetAfter: 30.67,
      weeklyBudgetBefore: 249.67,
      weeklyBudgetAfter: 214.67,
    });
    expect(sim.mutation?.type).toBe("none");

    const asked = await runLocalAsk("What if I spend $60?", ctx);
    expect(asked.simulation?.dailyBudgetBefore).toBe(35.67);
    expect(asked.simulation?.dailyBudgetAfter).toBe(30.67);
    expect(asked.pendingTransaction).toBeUndefined();
    expect(asked.mutations.filter(function (m) { return m.type === "transaction"; })).toEqual([]);
    expect(asked.message.content).toMatch(/Confirm purchase or cancel/i);
  });

  it.each(CLOCKS)("Singapore at %s: 9 days and $200.00/day", (when) => {
    vi.useFakeTimers();
    vi.setSystemTime(when);
    const demo = createSingaporeDemoData();
    const ctx = {
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      locale: "en" as const,
    };

    const daily = executeTool("getDailyBudget", {}, ctx);
    expect(daily.data).toMatchObject({ daysRemaining: 9, dailySafeSpend: 200 });
  });

  it("uses a JSON-revived ISO now the same way Azure would", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 17, 11, 0, 0));
    const demo = createMedellinDemoData();
    const iso = budgetNowForTrip(demo.trip).toISOString();
    const sim = executeTool(
      "simulatePurchase",
      { amount: 60, currency: "USD" },
      {
        trip: demo.trip,
        pockets: demo.pockets,
        transactions: demo.transactions,
        goals: demo.goals,
        locale: "en",
        now: iso,
      }
    );
    expect(sim.data).toMatchObject({ dailyBudgetBefore: 35.67, dailyBudgetAfter: 30.67 });
  });
});

describe("Azure what-if always returns the Confirm card", () => {
  it("keeps simulatePurchase on the response even with mutation none", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 17, 11, 0, 0));
    const demo = createMedellinDemoData();
    const ctx = {
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      locale: "en" as const,
    };
    const tool = executeTool("simulatePurchase", { amount: 60, currency: "USD" }, ctx);
    const built = buildNaviResponse({
      userText: "What if I spend $60?",
      assistantContent: "Would you like to confirm this expense?",
      executedTools: [{ name: "simulatePurchase", args: { amount: 60, currency: "USD" }, result: tool }],
      locale: "en",
    });
    expect(built.simulation?.dailyBudgetAfter).toBe(30.67);
    expect(built.pendingTransaction).toBeUndefined();
  });

  it("attaches simulatePurchase when Azure only returned text", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 17, 11, 0, 0));
    const demo = createMedellinDemoData();
    const ctx = {
      trip: demo.trip,
      pockets: demo.pockets,
      transactions: demo.transactions,
      goals: demo.goals,
      locale: "en" as const,
    };
    const bare = buildNaviResponse({
      userText: "What if I spend $60?",
      assistantContent: "Would you like to confirm this expense?",
      executedTools: [],
      locale: "en",
    });
    expect(bare.simulation).toBeUndefined();
    const attached = attachAffordSimulation("What if I spend $60?", ctx, bare);
    expect(attached.simulation?.dailyBudgetBefore).toBe(35.67);
    expect(attached.simulation?.dailyBudgetAfter).toBe(30.67);
    expect(attached.pendingTransaction).toBeUndefined();
  });
});

describe("parseNaviBold", () => {
  it("turns **markers** into bold parts", () => {
    const parts = parseNaviBold("Daily budget: from **$35.67** to **$30.67**");
    const bold = parts.filter(function (part) {
      return part.bold;
    }).map(function (part) {
      return part.text;
    });
    expect(bold).toEqual(["$35.67", "$30.67"]);
    expect(parts.some(function (part) { return part.text.includes("**"); })).toBe(false);
  });
});
