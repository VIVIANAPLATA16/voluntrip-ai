import { describe, expect, it } from "vitest";
import { attachAffordSimulation } from "./affordSimulation";
import { buildNaviResponse } from "./responseBuilder";
import { executeTool } from "./tools";
import { naviQlooCite, tastePhrase } from "./qlooVoice";
import type { Experience } from "@/lib/experiences";
import { formatMoney } from "@/lib/constants";
import { t } from "@/lib/i18n/dictionaries";

const ENTITY_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VEGAN = "urn:tag:genre:place:restaurant:vegan";

function experience(partial: {
  name?: string;
  neighborhood?: string;
  source?: Experience["source"];
  rank?: number;
  total?: number;
  signals?: string[];
  entities?: string[];
  matchedTags?: string[];
}): Experience {
  const source = partial.source ?? "qloo";
  return {
    id: "fonda",
    name: partial.name ?? "Fonda La Chismosa",
    neighborhood: partial.neighborhood ?? "La 70",
    tags: [{ id: VEGAN, name: "Vegan", type: "urn:tag:genre:place" }],
    popularity: 0.5,
    priceLevel: 2,
    source,
    estimatedCost: { amount: 25, basis: "price_level", isEstimate: true },
    culturalFit: 80,
    financialFit: 70,
    contextFit: 50,
    valueScore: 72,
    whyQloo: {
      matchedTags: partial.matchedTags ?? [VEGAN],
      rank: partial.rank ?? 2,
      source,
      queriedAt: "2026-10-19T12:00:00.000Z",
      signals: partial.signals ?? ["reggaeton"],
      totalResults: partial.total ?? 10,
      entities: partial.entities,
    },
    whyVoluntrip: {
      estimatedCost: { amount: 25, basis: "price_level", isEstimate: true },
      dailySafeSpendBefore: 40,
      dailySafeSpendAfter: 15,
      protectedMoneyUntouched: true,
      runwayStatus: "on_track",
    },
  };
}

describe("naviQlooCite", () => {
  it("cites live Qloo rank-of-N with signal and entity names, never UUIDs", () => {
    const cite = naviQlooCite(
      "en",
      experience({
        signals: ["reggaeton"],
        entities: ["Bad Bunny"],
        rank: 2,
        total: 10,
      })
    );
    expect(cite.showAsQloo).toBe(true);
    expect(cite.text).toContain("Fonda La Chismosa - La 70");
    expect(cite.text).toContain("#2 of 10");
    expect(cite.text).toContain("reggaeton");
    expect(cite.text).toContain("Bad Bunny");
    expect(cite.text).toMatch(/Source: qloo/);
    expect(cite.text).not.toContain(ENTITY_UUID);
    expect(cite.text).not.toContain("urn:");
    expect(t("es", "navi.voice.qloo_rank", {
      place: "Fonda La Chismosa - La 70",
      rank: 2,
      total: 10,
      taste: "reggaeton, Bad Bunny",
      source: "qloo",
    })).toContain("Qloo puso Fonda La Chismosa - La 70 en el #2 de 10");
    expect(t("es", "navi.voice.qloo_rank", {
      place: "Fonda La Chismosa - La 70",
      rank: 2,
      total: 10,
      taste: "reggaeton, Bad Bunny",
      source: "qloo",
    })).toMatch(/Fuente: qloo/);
    expect(t("pt", "navi.voice.qloo_rank", {
      place: "Fonda La Chismosa - La 70",
      rank: 2,
      total: 10,
      taste: "reggaeton, Bad Bunny",
      source: "qloo",
    })).toMatch(/Fonte: qloo/);
    expect(t("es", "navi.voice.qloo_rank", {
      place: "Fonda",
      rank: 1,
      total: 3,
      taste: "salsa",
      source: "qloo",
    })).not.toMatch(/Source: qloo/);
  });

  it("does not name Qloo as the source for demo or baseline", () => {
    const demo = naviQlooCite("en", experience({ source: "demo", signals: ["salsa"] }), false);
    expect(demo.showAsQloo).toBe(false);
    expect(demo.text).toMatch(/generic, not from Qloo/);
    expect(demo.text).not.toMatch(/Source: qloo/);
    expect(demo.text).not.toMatch(/#2 of 10/);

    const baseline = naviQlooCite(
      "en",
      experience({ source: "qloo", signals: ["salsa"], entities: ["Bad Bunny"] }),
      true
    );
    expect(baseline.showAsQloo).toBe(false);
    expect(baseline.text).not.toMatch(/Source: qloo/);
  });

  it("says loved-entity ranking when entities were sent and no tags matched", () => {
    const cite = naviQlooCite(
      "en",
      experience({
        matchedTags: [],
        entities: ["Bad Bunny"],
        signals: [],
        rank: 2,
        total: 10,
      })
    );
    expect(cite.text).toMatch(/Ranked by your loved entities/);
    expect(cite.text).toContain("Bad Bunny");
    expect(cite.text).not.toMatch(/Matched tags: none/);
    expect(cite.text).toMatch(/Source: qloo/);
  });
});

describe("tastePhrase", () => {
  it("joins readable labels and drops blanks", () => {
    expect(tastePhrase(["salsa"], ["Bad Bunny"])).toBe("salsa, Bad Bunny");
    expect(tastePhrase([], [])).toBe("");
  });
});

describe("unified budget numbers", () => {
  it("copies daily safe from simulatePurchase, never invents", () => {
    const place = experience({});
    const trip = {
      id: "t1",
      destination: "Lima, Peru",
      city: "Lima",
      country: "Peru",
      countryCode: "PE",
      flag: "🇵🇪",
      baseCurrency: "USD" as const,
      localCurrency: "PEN" as const,
      startDate: "2026-10-01",
      endDate: "2026-10-21",
      initialBudget: 1500,
      includedBenefits: ["accommodation"] as const,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const sim = executeTool(
      "simulatePurchase",
      { amount: place.estimatedCost.amount, currency: "USD" },
      {
        trip,
        pockets: [],
        transactions: [],
        goals: [],
        locale: "en",
        now: new Date("2026-10-19T12:00:00.000Z"),
      }
    );
    expect(sim.ok).toBe(true);
    const data = sim.data as {
      purchaseAmount: number;
      dailyBudgetBefore: number;
      dailyBudgetAfter: number;
    };
    expect(data.purchaseAmount).toBe(25);
    expect(typeof data.dailyBudgetBefore).toBe("number");
    expect(typeof data.dailyBudgetAfter).toBe("number");
  });

  it("keeps Afford card numbers identical to simulatePurchase and cites the place", () => {
    const place = experience({ signals: ["reggaeton"], entities: ["Bad Bunny"], rank: 2, total: 10 });
    const trip = {
      id: "t1",
      destination: "Medellín, Colombia",
      city: "Medellín",
      country: "Colombia",
      countryCode: "CO",
      flag: "🇨🇴",
      baseCurrency: "USD" as const,
      localCurrency: "COP" as const,
      startDate: "2026-10-01",
      endDate: "2026-10-21",
      initialBudget: 1500,
      includedBenefits: ["accommodation"] as const,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const ctx = {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "en" as const,
      now: new Date("2026-10-19T12:00:00.000Z"),
      lastRecommendation: {
        best: place,
        alternative: null,
        usedBaseline: false,
        missingProfile: false,
        missingConsent: false,
        qlooSource: "qloo" as const,
      },
    };
    const sim = executeTool("simulatePurchase", { amount: 25, currency: "USD" }, ctx);
    const bare = buildNaviResponse({
      userText: "What if I spend $25 at Fonda La Chismosa - La 70?",
      assistantContent: "ignored",
      executedTools: [{ name: "simulatePurchase", args: { amount: 25, currency: "USD" }, result: sim }],
      locale: "en",
    });
    const attached = attachAffordSimulation(
      "What if I spend $25 at Fonda La Chismosa - La 70?",
      ctx,
      bare
    );
    const data = sim.data as {
      dailyBudgetBefore: number;
      dailyBudgetAfter: number;
      weeklyBudgetBefore: number;
      weeklyBudgetAfter: number;
    };
    expect(attached.simulation).toEqual(bare.simulation);
    expect(attached.message.content).toContain(
      formatMoney(data.dailyBudgetBefore, "USD")
    );
    expect(attached.message.content).toContain(
      formatMoney(data.dailyBudgetAfter, "USD")
    );
    expect(attached.message.content).toContain(
      formatMoney(data.weeklyBudgetBefore, "USD")
    );
    expect(attached.message.content).toContain(
      formatMoney(data.weeklyBudgetAfter, "USD")
    );
    expect(attached.message.content).toMatch(/#2 of 10/);
    expect(attached.message.content).toContain("Bad Bunny");
    expect(attached.message.content).toMatch(/Confirm purchase or cancel/i);
    expect(attached.pendingTransaction).toBeUndefined();
  });
});
