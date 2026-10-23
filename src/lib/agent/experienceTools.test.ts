import { describe, expect, it, vi } from "vitest";
import type { CulturalProfile, Pocket, Trip } from "@/types";
import type { QlooPlace, QlooResult } from "@/lib/qloo/types";
import { executeTool } from "./tools";
import { executeToolAsync, isMedellinCity, recommendExperience } from "./experienceTools";
import { detectLocalAskIntent, runLocalAsk } from "./localAsk";
import { applyStretchPlanToNaviResponse, formatStretchPlanReply } from "./experienceReply";
import { buildNaviResponse } from "./responseBuilder";
import { GENERIC_BASELINE_LABEL, resetStretchPlanCache } from "@/lib/experiences";
import type { StretchPlanResult } from "@/lib/experiences";

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
  entertainment: [{ label: "live music", qlooTagId: "urn:tag:genre:place:restaurant:live_music_bar" }],
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

    searchPlaces.mockClear();
    const lovedWithoutConsent = await runLocalAsk(
      "I want to go out tonight",
      ctx({
        culturalProfile: {
          ...consentedProfile,
          consent: { granted: false, grantedAt: null },
          lovedEntities: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              name: "Bad Bunny",
              type: "urn:entity:artist",
            },
          ],
        },
        searchPlaces,
      })
    );
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(lovedWithoutConsent.experienceRecommendation?.qlooSource).toBe("skipped");
  });

  it("sends loved entities with tonight and keeps source qloo", async () => {
    const entityId = "550e8400-e29b-41d4-a716-446655440000";
    const searchPlaces = vi.fn(async () =>
      qlooLive([
        salsaPlace,
        { ...salsaPlace, id: "bar-2", name: "Bar Dos", rank: 2 },
        { ...salsaPlace, id: "bar-3", name: "Bar Tres", rank: 3 },
      ])
    );
    const result = await runLocalAsk(
      "I want to go out tonight",
      ctx({
        culturalProfile: {
          ...consentedProfile,
          lovedEntities: [{ id: entityId, name: "Bad Bunny", type: "urn:entity:artist" }],
        },
        searchPlaces,
      })
    );
    expect(searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "Medellín",
        entities: [entityId],
        take: 10,
      })
    );
    expect(result.experienceRecommendation?.qlooSource).toBe("qloo");
    expect(result.experienceRecommendation?.best?.whyQloo.entities).toEqual(["Bad Bunny"]);
    expect(result.experienceRecommendation?.best?.source).toBe("qloo");
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

  it("keeps What if I spend $25 at a place on simulatePurchase with the same amount", async () => {
    const withPlace = await runLocalAsk(
      "What if I spend $25 at Fonda La Chismosa - La 70?",
      ctx()
    );
    const withoutPlace = await runLocalAsk("What if I spend $25?", ctx());
    expect(withPlace.simulation?.purchaseAmount).toBe(25);
    expect(withoutPlace.simulation?.purchaseAmount).toBe(25);
    expect(withPlace.simulation?.purchaseAmount).toBe(withoutPlace.simulation?.purchaseAmount);
    expect(withPlace.pendingTransaction).toBeUndefined();
  });

  it("explains Why this? with loved-entity ranking instead of Matched tags: none", async () => {
    const entityId = "550e8400-e29b-41d4-a716-446655440000";
    const nightlifeOnly = {
      ...salsaPlace,
      id: "fonda",
      name: "Fonda La Chismosa",
      neighborhood: "La 70",
      rank: 2,
      tags: [{ id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" }],
    };
    const searchPlaces = vi.fn(async () =>
      qlooLive([
        nightlifeOnly,
        { ...nightlifeOnly, id: "bar-2", name: "Bar Dos", rank: 3 },
        { ...nightlifeOnly, id: "bar-3", name: "Bar Tres", rank: 4 },
      ])
    );
    const rec = await runLocalAsk(
      "I want to go out tonight",
      ctx({
        culturalProfile: {
          ...consentedProfile,
          lovedEntities: [{ id: entityId, name: "Bad Bunny", type: "urn:entity:artist" }],
        },
        searchPlaces,
      })
    );
    expect(rec.experienceRecommendation?.best?.whyQloo.entities).toEqual(["Bad Bunny"]);
    expect(rec.experienceRecommendation?.best?.whyQloo.matchedTags).toEqual([]);

    const why = await runLocalAsk(
      "why this?",
      ctx({
        lastRecommendation: rec.experienceRecommendation,
        searchPlaces,
      })
    );
    expect(why.message.content).toMatch(/Ranked by your loved entities/);
    expect(why.message.content).not.toMatch(/Matched tags: none/);
    expect(why.message.content).toMatch(/Source: qloo/);
    expect(why.message.content).not.toContain(entityId);
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

describe("city-scoped baseline", () => {
  const singaporeTrip: Trip = {
    ...trip,
    id: "t-sg",
    destination: "Singapore",
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    flag: "🇸🇬",
    localCurrency: "SGD",
  };

  it("treats Medellín spellings as the baseline city", () => {
    expect(isMedellinCity("Medellín")).toBe(true);
    expect(isMedellinCity("Medellin")).toBe(true);
    expect(isMedellinCity("MEDELLÍN")).toBe(true);
    expect(isMedellinCity("Singapore")).toBe(false);
  });

  it("does not use the Medellín baseline when Qloo is unavailable in Singapore", async () => {
    const searchPlaces = vi.fn(async () => ({
      source: "unavailable" as const,
      places: [] as [],
      reason: "QLOO_NETWORK" as const,
    }));
    const rec = await recommendExperience(
      { city: "Singapore", intent: "tonight" },
      ctx({ trip: singaporeTrip, searchPlaces })
    );
    const payload = rec.data as {
      best: unknown;
      alternative: unknown;
      usedBaseline: boolean;
      qlooSource: string;
    };
    expect(payload.best).toBeNull();
    expect(payload.alternative).toBeNull();
    expect(payload.usedBaseline).toBe(false);
    expect(payload.qlooSource).toBe("unavailable");
  });

  it("does not use the Medellín baseline when Qloo is demo/NO_KEY in Singapore", async () => {
    const searchPlaces = vi.fn(async () => ({
      source: "demo" as const,
      reason: "NO_KEY" as const,
      places: [
        {
          id: "demo-medellin-plaza-botero",
          name: "Plaza Botero",
          tags: [],
          popularity: 0.8,
          priceLevel: 1 as const,
          rank: 1,
        },
      ],
    }));
    const rec = await recommendExperience(
      { city: "Singapore", intent: "tonight" },
      ctx({ trip: singaporeTrip, searchPlaces })
    );
    const payload = rec.data as {
      best: { name?: string } | null;
      usedBaseline: boolean;
      qlooSource: string;
    };
    expect(payload.best).toBeNull();
    expect(payload.usedBaseline).toBe(false);
    expect(payload.qlooSource).toBe("demo");
    expect(payload.best?.name).not.toBe("Plaza Botero");
    expect(payload.best?.name).not.toBe("Cerro Nutibara lookout");
  });

  it("keeps Singapore without consent empty and does not query or invent places", async () => {
    const searchPlaces = vi.fn(async () => qlooLive([salsaPlace]));
    const rec = await recommendExperience(
      { city: "Singapore", intent: "tonight" },
      ctx({
        trip: singaporeTrip,
        searchPlaces,
        culturalProfile: {
          ...consentedProfile,
          consent: { granted: false, grantedAt: null },
        },
      })
    );
    const payload = rec.data as {
      best: unknown;
      usedBaseline: boolean;
      qlooSource: string;
      missingConsent: boolean;
    };
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(payload.best).toBeNull();
    expect(payload.usedBaseline).toBe(false);
    expect(payload.qlooSource).toBe("skipped");
    expect(payload.missingConsent).toBe(true);
  });

  it("still uses the labeled Medellín baseline when Qloo is down there", async () => {
    const searchPlaces = vi.fn(async () => ({
      source: "unavailable" as const,
      places: [] as [],
      reason: "QLOO_TIMEOUT" as const,
    }));
    const rec = await recommendExperience(
      { city: "Medellin", intent: "tonight" },
      ctx({
        trip: { ...trip, city: "Medellin" },
        searchPlaces,
      })
    );
    const payload = rec.data as {
      best: { name?: string; source?: string } | null;
      usedBaseline: boolean;
      qlooSource: string;
    };
    expect(payload.usedBaseline).toBe(true);
    expect(payload.qlooSource).toBe("unavailable");
    expect(payload.best?.name).toBe("Cerro Nutibara lookout");
    expect(payload.best?.source).not.toBe("qloo");
  });
});

describe("planStretch NAVI", () => {
  const places: QlooPlace[] = [
    salsaPlace,
    { ...salsaPlace, id: "two", name: "Cafe Dos", priceLevel: 1, rank: 2 },
    { ...salsaPlace, id: "three", name: "Bar Tres", priceLevel: 4, rank: 3 },
  ];

  it("detects stretch phrases in en, es, and pt", () => {
    expect(detectLocalAskIntent("stretch my trip").intent).toBe("stretch");
    expect(detectLocalAskIntent("plan 3 nights").intent).toBe("stretch");
    expect(detectLocalAskIntent("armar plan").intent).toBe("stretch");
    expect(detectLocalAskIntent("planea mis próximas noches").intent).toBe("stretch");
    expect(detectLocalAskIntent("planeje minhas noites").intent).toBe("stretch");
  });

  it("never creates a transaction and copies numbers from the plan object", async () => {
    resetStretchPlanCache();
    const searchPlaces = vi.fn(async () => qlooLive(places));
    const tool = await executeToolAsync("planStretch", { nights: 3 }, ctx({ searchPlaces }));
    expect(tool.ok).toBe(true);
    expect(tool.mutation?.type).toBe("none");

    resetStretchPlanCache();
    const local = await runLocalAsk("stretch my trip", ctx({ searchPlaces }));
    expect(local.mutations).toEqual([]);
    expect(local.pendingTransaction).toBeUndefined();
    expect(local.stretchPlan?.kind).toBe("ready");
    if (local.stretchPlan?.kind !== "ready") return;
    expect(local.message.content).toBe(formatStretchPlanReply("en", local.stretchPlan));
    expect(local.message.content).toContain(String(local.stretchPlan.best.totalDisplay));
    expect(local.message.content).not.toMatch(/lasts .* more days/i);
  });

  it("does not query Qloo without consent", async () => {
    resetStretchPlanCache();
    const searchPlaces = vi.fn();
    const local = await runLocalAsk("armar plan", ctx({
      locale: "es",
      culturalProfile: { ...consentedProfile, consent: { granted: false, grantedAt: null } },
      searchPlaces,
    }));
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(local.stretchPlan?.kind).toBe("needs_consent");
  });

  it("replaces invented Azure text with the plan object numbers", async () => {
    resetStretchPlanCache();
    const searchPlaces = vi.fn(async () => qlooLive(places));
    const tool = await executeToolAsync("planStretch", { nights: 3 }, ctx({ searchPlaces }));
    const plan = tool.data as StretchPlanResult;
    const invented = buildNaviResponse({
      userText: "stretch my trip",
      assistantContent: "Your trip lasts 9 more days and the plan costs $9999.",
      executedTools: [],
      locale: "en",
    });
    const applied = applyStretchPlanToNaviResponse("en", invented, plan);
    expect(applied.message.content).toBe(formatStretchPlanReply("en", plan));
    expect(applied.message.content).not.toMatch(/9999/);
    expect(applied.message.content).not.toMatch(/lasts 9 more days/);
    expect(applied.stretchPlan).toBe(plan);
  });
});
