import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Trip } from "@/types";
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
});
