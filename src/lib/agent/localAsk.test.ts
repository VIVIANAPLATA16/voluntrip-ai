import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "@/types";
import { t } from "@/lib/i18n/dictionaries";

const { findGroupTravelBuddies } = vi.hoisted(function () {
  return { findGroupTravelBuddies: vi.fn() };
});

vi.mock("@/lib/groups/buddy", async function () {
  const actual = await vi.importActual<typeof import("@/lib/groups/buddy")>(
    "@/lib/groups/buddy"
  );
  return { ...actual, findGroupTravelBuddies };
});

import { detectLocalAskIntent, runLocalAsk } from "./localAsk";

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
  includedBenefits: ["accommodation"],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const ctx = {
  trip,
  pockets: [] as [],
  transactions: [] as [],
  goals: [] as [],
  locale: "en" as const,
};

describe("runLocalAsk locale", () => {
  it("responds in Spanish when profile locale is es, even if user writes in English", async () => {
    const result = await runLocalAsk("How much can I spend today?", {
      ...ctx,
      locale: "es",
    });

    expect(result.message.locale).toBe("es");
    expect(result.message.content).toMatch(/Puedes gastar con seguridad/i);
    expect(result.message.content).not.toMatch(/You can safely spend/i);
  });

  it("responds in Portuguese when profile locale is pt", async () => {
    const result = await runLocalAsk("How much can I spend today?", {
      ...ctx,
      locale: "pt",
    });

    expect(result.message.content).toMatch(/Você pode gastar com segurança/i);
  });

  it("returns mock limitation message for unmatched general questions", async () => {
    const result = await runLocalAsk(
      "What documents do I need to volunteer in Costa Rica?",
      ctx
    );

    expect(result.message.content).toMatch(/needs NAVI with real AI/i);
    expect(result.message.content).not.toMatch(/You can safely spend/i);
    expect(result.mutations).toEqual([]);
  });
});

describe("detectLocalAskIntent travel buddy", () => {
  it("detects travel-buddy phrasing in en, es, and pt without selecting a tool", () => {
    const en = detectLocalAskIntent("Find me a travel buddy");
    const es = detectLocalAskIntent("Busca un compañero de viaje");
    const pt = detectLocalAskIntent("Encontre alguém para viajar comigo");

    expect(en).toEqual({ intent: "buddy", tools: [] });
    expect(es).toEqual({ intent: "buddy", tools: [] });
    expect(pt).toEqual({ intent: "buddy", tools: [] });
  });

  it("does not treat place, budget, or expense requests as a travel buddy search", () => {
    expect(detectLocalAskIntent("find me a better option").intent).toBe("alternative");
    expect(detectLocalAskIntent("find me a better option").tools).toEqual(["findBetterOption"]);
    expect(detectLocalAskIntent("I want to go out tonight").intent).toBe("recommend");
    expect(detectLocalAskIntent("plan for today").intent).toBe("myday");
    expect(detectLocalAskIntent("How much can I spend today?").intent).toBe("budget");
    expect(detectLocalAskIntent("What if I spend $60?").intent).toBe("afford");
    expect(detectLocalAskIntent("I spent 15 dollars on lunch.").intent).toBe("expense");
  });
});

describe("runLocalAsk travel buddy", () => {
  beforeEach(function () {
    findGroupTravelBuddies.mockReset();
    findGroupTravelBuddies.mockResolvedValue({ kind: "no_group" });
  });

  it("asks to create or join a group when none is active", async () => {
    const result = await runLocalAsk("Find me a travel buddy", ctx);
    expect(findGroupTravelBuddies).toHaveBeenCalledOnce();
    expect(result.message.content).toBe(t("en", "navi.buddy.no_group"));
    expect(result.experienceRecommendation).toBeUndefined();
    expect(result.mutations).toEqual([]);
    expect(result.message.toolCalls ?? []).toEqual([]);
    expect(result.message.content).not.toMatch(/secret|memberId/i);
  });

  it("answers in Spanish when asking for a companion with no group", async () => {
    const result = await runLocalAsk("Busca un compañero de viaje", {
      ...ctx,
      locale: "es",
    });
    expect(result.message.content).toBe(t("es", "navi.buddy.no_group"));
  });

  it("explains when the group cannot be read", async () => {
    findGroupTravelBuddies.mockResolvedValue({ kind: "unavailable" });
    const result = await runLocalAsk("Find me a travel buddy", ctx);
    expect(result.message.content).toBe(t("en", "navi.buddy.unavailable"));
  });

  it("invites sharing the group code when nobody is sharing tastes", async () => {
    findGroupTravelBuddies.mockResolvedValue({
      kind: "none_sharing",
      code: "ABCD2345",
    });
    const result = await runLocalAsk("Find me a travel buddy", ctx);
    expect(result.message.content).toBe(
      t("en", "navi.buddy.none_sharing", { code: "ABCD2345" })
    );
    expect(result.message.content).not.toMatch(/available today/i);
  });

  it("does not invent people when there is no taste overlap", async () => {
    findGroupTravelBuddies.mockResolvedValue({ kind: "no_match", code: "ABCD2345" });
    const result = await runLocalAsk("Find me a travel buddy", ctx);
    expect(result.message.content).toBe(
      t("en", "navi.buddy.no_match", { code: "ABCD2345" })
    );
    expect(result.message.content).not.toMatch(/Alex|Sam|Jordan/);
  });

  it("lists only real aliases and overlapping shared tastes", async () => {
    findGroupTravelBuddies.mockResolvedValue({
      kind: "matches",
      code: "ABCD2345",
      members: [{ alias: "Ana", tags: ["urn:tag:genre:music:rock"] }],
      common: ["urn:tag:genre:music:rock"],
      almost: [],
    });
    const result = await runLocalAsk("Find me a travel buddy", ctx);
    expect(result.message.content).toContain("Ana");
    expect(result.message.content).toMatch(/rock/i);
    expect(result.message.content).not.toMatch(/available today|accepted/i);
    expect(result.message.content).not.toMatch(/secret|memberId/i);
  });

  it("keeps finance, expense, and afford intents on their existing tools", async () => {
    const budget = await runLocalAsk("How much can I spend today?", ctx);
    expect(budget.message.content).toMatch(/safely spend/i);
    expect(findGroupTravelBuddies).not.toHaveBeenCalled();

    const expense = await runLocalAsk("I spent 15 dollars on lunch.", ctx);
    expect(expense.pendingTransaction).toBeTruthy();

    const afford = await runLocalAsk("What if I spend $60?", ctx);
    expect(afford.simulation).toBeTruthy();
  });
});
