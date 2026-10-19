import { describe, expect, it, vi } from "vitest";
import type { CulturalProfile, Pocket, Trip } from "@/types";
import type { QlooPlace, QlooResult } from "@/lib/qloo/types";
import { executeTool } from "./tools";
import { executeToolAsync, recommendExperience } from "./experienceTools";
import { detectLocalAskIntent, runLocalAsk } from "./localAsk";
import { GENERIC_BASELINE_LABEL } from "@/lib/experiences";

const SALSA = "urn:tag:genre:music:salsa";
const NIGHTLIFE = "urn:tag:genre:place:nightlife";

const trip: Trip = {
  id: "t1",
  destination: "Medellín, Colombia",
  city: "Medellín",
  country: "Colombia",
  countryCode: "CO",
  flag: "🇨🇴",
  baseCurrency: "USD",
  localCurrency: "COP",
  startDate: "2026-10-01",
  endDate: "2026-10-21",
  initialBudget: 1500,
  includedBenefits: ["accommodation"],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const pockets: Pocket[] = [];
const now = new Date("2026-10-19T12:00:00.000Z");

const consentedProfile: CulturalProfile = {
  id: "default",
  consent: { granted: true, grantedAt: "2026-10-19T00:00:00.000Z" },
  music: [{ label: "salsa", qlooTagId: SALSA }],
  food: [],
  entertainment: [{ label: "vida nocturna", qlooTagId: NIGHTLIFE }],
  activities: [],
  updatedAt: "2026-10-19T00:00:00.000Z",
};

const salsaPlace: QlooPlace = {
  id: "el-social-salsa",
  name: "El Social Salsa",
  tags: [
    { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
    { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
  ],
  popularity: 0.8,
  priceLevel: 2,
  rank: 1,
  neighborhood: "Centro",
};

function qlooLive(places: QlooPlace[]): Extract<QlooResult, { source: "qloo" }> {
  return { source: "qloo", places };
}

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    trip,
    pockets,
    transactions: [],
    goals: [],
    locale: "en" as const,
    now,
    culturalProfile: consentedProfile,
    ...overrides,
  };
}

describe("detectLocalAskIntent", () => {
  it("detects tonight / recommend / why / alternative in en, es, and pt", () => {
    expect(detectLocalAskIntent("I want to go out tonight").intent).toBe("recommend");
    expect(detectLocalAskIntent("quiero salir esta noche").intent).toBe("recommend");
    expect(detectLocalAskIntent("quero sair esta noite").intent).toBe("recommend");
    expect(detectLocalAskIntent("why this?").intent).toBe("why");
    expect(detectLocalAskIntent("por qué").intent).toBe("why");
    expect(detectLocalAskIntent("find me a better option").intent).toBe("alternative");
    expect(detectLocalAskIntent("otra opción").intent).toBe("alternative");
  });

  it("keeps what-if spend on simulatePurchase", () => {
    const detected = detectLocalAskIntent("What if I spend $60?");
    expect(detected.intent).toBe("afford");
    expect(detected.tools).toContain("simulatePurchase");
  });
});

describe("NAVI experience tools", () => {
  it("tonight with consent uses Qloo source and splits evidence", async () => {
    const searchPlaces = vi.fn(async () => qlooLive([salsaPlace]));
    const result = await runLocalAsk("I want to go out tonight", ctx({ searchPlaces }));

    expect(searchPlaces).toHaveBeenCalled();
    expect(searchPlaces.mock.calls[0][0]).toMatchObject({ city: "Medellín", take: 10 });
    expect(result.message.content).toMatch(/From Qloo/);
    expect(result.message.content).toMatch(/From Voluntrip/);
    expect(result.message.content).toMatch(/Voluntrip Value Score/);
    expect(result.message.content).toMatch(/estimate/i);
    expect(result.message.content).toMatch(/El Social Salsa/);
    expect(result.experienceRecommendation?.qlooSource).toBe("qloo");
    expect(result.experienceRecommendation?.usedBaseline).toBe(false);
    expect(result.mutations).toEqual([]);
    expect(result.pendingTransaction).toBeUndefined();
  });

  it("does not call Qloo without a profile or consent and uses the labeled baseline", async () => {
    const searchPlaces = vi.fn(async () => qlooLive([salsaPlace]));

    const noProfile = await runLocalAsk(
      "I want to go out tonight",
      ctx({ culturalProfile: null, searchPlaces })
    );
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(noProfile.message.content).toMatch(/generic, not from Qloo/);
    expect(noProfile.experienceRecommendation?.qlooSource).toBe("skipped");
    expect(noProfile.experienceRecommendation?.usedBaseline).toBe(true);
    expect(noProfile.experienceRecommendation?.baselineLabel).toBe(GENERIC_BASELINE_LABEL);

    searchPlaces.mockClear();
    const noConsent = await runLocalAsk(
      "quiero salir esta noche",
      ctx({
        locale: "es",
        culturalProfile: {
          ...consentedProfile,
          consent: { granted: false, grantedAt: null },
        },
        searchPlaces,
      })
    );
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(noConsent.message.content).toMatch(/generic, not from Qloo/);
    expect(noConsent.experienceRecommendation?.qlooSource).toBe("skipped");
  });

  it("uses the labeled baseline when Qloo is unavailable and never reports source qloo", async () => {
    const searchPlaces = vi.fn(async () => ({
      source: "unavailable" as const,
      places: [] as [],
      reason: "QLOO_NETWORK" as const,
    }));
    const result = await runLocalAsk("I want to go out tonight", ctx({ searchPlaces }));

    expect(searchPlaces).toHaveBeenCalled();
    expect(result.message.content).toMatch(/unavailable|generic, not from Qloo/i);
    expect(result.message.content).not.toMatch(/Source: qloo/);
    expect(result.experienceRecommendation?.qlooSource).toBe("unavailable");
    expect(result.experienceRecommendation?.usedBaseline).toBe(true);
    expect(result.experienceRecommendation?.best?.source).not.toBe("qloo");
  });

  it("never creates a transaction from cultural tools", async () => {
    const searchPlaces = vi.fn(async () => qlooLive([salsaPlace]));
    const rec = await executeToolAsync(
      "recommendExperience",
      { city: "Medellín", intent: "tonight" },
      ctx({ searchPlaces })
    );
    expect(rec.ok).toBe(true);
    expect(rec.mutation?.type).toBe("none");

    const sync = executeTool("recommendExperience", { city: "Medellín" }, ctx());
    expect(sync.ok).toBe(false);
    expect(sync.mutation?.type).toBe("none");

    const local = await runLocalAsk("I want to go out tonight", ctx({ searchPlaces }));
    expect(local.pendingTransaction).toBeUndefined();
    expect(local.mutations).toEqual([]);
  });

  it("routes What if I spend $60? through simulatePurchase and confirmation", async () => {
    const searchPlaces = vi.fn();
    const result = await runLocalAsk("What if I spend $60?", ctx({ searchPlaces }));

    expect(searchPlaces).not.toHaveBeenCalled();
    expect(result.simulation).toBeDefined();
    expect(result.simulation?.purchaseAmount).toBe(60);
    expect(result.message.content).toMatch(/Confirm purchase|Confirm/i);
    expect(result.pendingTransaction).toBeUndefined();
    expect(result.message.toolCalls?.some((call) => call.name === "simulatePurchase")).toBe(
      true
    );
  });

  it("findBetterOption reports none when there is no cheaper cultural alternative", async () => {
    const searchPlaces = vi.fn(async () => qlooLive([salsaPlace]));
    const rec = await recommendExperience(
      { city: "Medellín", intent: "tonight" },
      ctx({ searchPlaces })
    );
    const payload = rec.data as { alternative: unknown };
    expect(payload.alternative).toBeNull();

    const followUp = await runLocalAsk(
      "find me a better option",
      ctx({
        searchPlaces,
        lastRecommendation: rec.data as never,
      })
    );
    expect(followUp.message.content).toMatch(/don't have a cheaper alternative/i);
  });
});
