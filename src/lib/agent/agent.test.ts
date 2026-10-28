import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

import { NaviAgent } from "./agent";

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

const mockNaviResponse = {
  message: {
    id: "assistant-1",
    role: "assistant" as const,
    content: "Remote NAVI reply",
    timestamp: "2026-08-01T12:00:00.000Z",
    locale: "en" as const,
  },
  mutations: [],
};

describe("NaviAgent remote mode", () => {
  const originalMockFlag = process.env.NEXT_PUBLIC_MOCK_AI;

  beforeEach(() => {
    findGroupTravelBuddies.mockReset();
    findGroupTravelBuddies.mockResolvedValue({ kind: "no_group" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => mockNaviResponse,
      })
    );
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_MOCK_AI = originalMockFlag;
    vi.unstubAllGlobals();
  });

  it("calls /api/navi with correct payload when NEXT_PUBLIC_MOCK_AI=false", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";

    const agent = new NaviAgent();
    const ctx = {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "en" as const,
      now: new Date("2026-10-21T16:00:00.000Z"),
    };

    const result = await agent.ask("How much can I spend today?", ctx);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe("/api/navi");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });

    const body = JSON.parse(init.body as string);
    expect(body.action).toBe("ask");
    expect(body.text).toBe("How much can I spend today?");
    expect(body.tripContext.trip.id).toBe("t1");
    expect(body.tripContext.now).toBe("2026-10-21T16:00:00.000Z");
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.some((m: { role: string }) => m.role === "user")).toBe(true);

    expect(result.message.content).toBe("Remote NAVI reply");
  });

  it("does not call fetch when NEXT_PUBLIC_MOCK_AI is not false", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "true";

    const agent = new NaviAgent();
    await agent.ask("How much can I spend today?", {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "en",
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns connection error message on fetch failure", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network down"))
    );

    const agent = new NaviAgent();
    const result = await agent.ask("Hello", {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "en",
    });

    expect(result.message.content).toMatch(/couldn't connect|conectar/i);
    expect(result.mutations).toEqual([]);
  });

  it("does not send Qloo or finance prompts to Azure for a better-option request when buddy is not detected", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";
    const agent = new NaviAgent();
    await agent.ask("find me a better option", {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "en",
    });
    expect(findGroupTravelBuddies).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("NaviAgent travel buddy intercept", () => {
  const originalMockFlag = process.env.NEXT_PUBLIC_MOCK_AI;
  const askCtx = {
    trip,
    pockets: [],
    transactions: [],
    goals: [],
    locale: "en" as const,
  };

  beforeEach(function () {
    findGroupTravelBuddies.mockReset();
    findGroupTravelBuddies.mockResolvedValue({ kind: "no_group" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => mockNaviResponse,
      })
    );
  });

  afterEach(function () {
    process.env.NEXT_PUBLIC_MOCK_AI = originalMockFlag;
    vi.unstubAllGlobals();
  });

  it("answers buddy from the group search before mock or Azure, including when Azure is enabled", async () => {
    findGroupTravelBuddies.mockResolvedValue({
      kind: "matches",
      code: "ABCD2345",
      members: [{ alias: "Ana", tags: ["urn:tag:genre:music:rock"] }],
      common: ["urn:tag:genre:music:rock"],
      almost: [],
    });

    for (const flag of ["true", "false"]) {
      process.env.NEXT_PUBLIC_MOCK_AI = flag;
      findGroupTravelBuddies.mockClear();
      vi.mocked(fetch).mockClear();

      const agent = new NaviAgent();
      const result = await agent.ask("Find me a travel buddy", askCtx);

      expect(findGroupTravelBuddies).toHaveBeenCalledOnce();
      expect(fetch).not.toHaveBeenCalled();
      expect(result.message.content).toContain("Ana");
      expect(result.message.content).toMatch(/rock/i);
      expect(result.message.content).not.toBe("Remote NAVI reply");
      expect(result.message.content).not.toMatch(/available today|secret|memberId/i);
      expect(agent.memory.all().map(function (message) {
        return message.role;
      })).toEqual(["user", "assistant"]);
    }
  });

  it("keeps honest empty states and locale when Azure would otherwise be used", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";
    const agent = new NaviAgent();
    const none = await agent.ask("Find me a travel buddy", askCtx);
    expect(none.message.content).toBe(t("en", "navi.buddy.no_group"));
    expect(fetch).not.toHaveBeenCalled();

    findGroupTravelBuddies.mockResolvedValue({
      kind: "none_sharing",
      code: "ABCD2345",
    });
    const spanish = await agent.ask("Busca un compañero de viaje", {
      ...askCtx,
      locale: "es",
    });
    expect(spanish.message.content).toBe(
      t("es", "navi.buddy.none_sharing", { code: "ABCD2345" })
    );
    expect(spanish.message.locale).toBe("es");
  });

  it("routes the Travel Buddy chip prompt without calling Azure or Qloo", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";
    const agent = new NaviAgent();
    const result = await agent.ask(t("en", "navi.quick_prompt.buddy"), askCtx);
    expect(findGroupTravelBuddies).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(result.message.content).toBe(t("en", "navi.buddy.no_group"));
  });

  it("returns NAVI's connection error if the group search throws", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";
    findGroupTravelBuddies.mockRejectedValue(new Error("IndexedDB blocked"));
    const agent = new NaviAgent();
    const result = await agent.ask("Find me a travel buddy", askCtx);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.message.content).toMatch(/couldn't connect|conectar/i);
    expect(result.mutations).toEqual([]);
  });

  it("leaves budget questions on the original mock or Azure path", async () => {
    process.env.NEXT_PUBLIC_MOCK_AI = "false";
    const agent = new NaviAgent();
    const remote = await agent.ask("How much can I spend today?", askCtx);
    expect(findGroupTravelBuddies).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(remote.message.content).toBe("Remote NAVI reply");
  });
});
