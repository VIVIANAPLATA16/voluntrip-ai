import { describe, expect, it, vi } from "vitest";
import type { CulturalProfile, Pocket, Trip } from "@/types";
import type { QlooPlace, QlooResult } from "@/lib/qloo/types";
import { t } from "@/lib/i18n/dictionaries";
import { runLocalAsk } from "./localAsk";
import { resetStretchPlanCache } from "@/lib/experiences";
import {
  NAVI_OPEN_PROFILE_ACTION,
  NAVI_PROFILE_HREF,
  naviActionFromToolData,
  naviMessageAction,
  withNaviMessageAction,
} from "./types";

const SALSA = "urn:tag:genre:music:salsa";

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
    { id: "urn:tag:genre:place:nightlife", name: "Nightlife", type: "urn:tag:genre:place" },
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

describe("NAVI open-profile action", () => {
  it("attaches open_profile when there is no Cultural DNA, and not when tastes exist", async () => {
    const searchPlaces = vi.fn(async () => qlooLive([salsaPlace]));

    const noProfile = await runLocalAsk(
      "I want to go out tonight",
      ctx({ culturalProfile: null, searchPlaces })
    );
    expect(naviMessageAction(noProfile.message)).toBe(NAVI_OPEN_PROFILE_ACTION);
    expect(noProfile.message.content).toMatch(/generic, not from Qloo/);

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
    expect(naviMessageAction(noConsent.message)).toBe(NAVI_OPEN_PROFILE_ACTION);

    const withTastes = await runLocalAsk(
      "I want to go out tonight",
      ctx({ searchPlaces })
    );
    expect(naviMessageAction(withTastes.message)).toBeUndefined();
    expect(withTastes.experienceRecommendation?.missingProfile).toBe(false);
    expect(withTastes.experienceRecommendation?.missingConsent).toBe(false);
  });

  it("marks Plan for today and Stretch when consent or profile is missing", async () => {
    const searchPlaces = vi.fn();
    const noProfileDay = await runLocalAsk(
      "plan for today",
      ctx({ culturalProfile: null, searchPlaces })
    );
    expect(noProfileDay.dayPlan?.kind).toBe("needs_profile");
    expect(naviMessageAction(noProfileDay.message)).toBe(NAVI_OPEN_PROFILE_ACTION);

    const noConsentDay = await runLocalAsk(
      "plan para hoy",
      ctx({
        locale: "es",
        culturalProfile: { ...consentedProfile, consent: { granted: false, grantedAt: null } },
        searchPlaces,
      })
    );
    expect(noConsentDay.dayPlan?.kind).toBe("needs_consent");
    expect(naviMessageAction(noConsentDay.message)).toBe(NAVI_OPEN_PROFILE_ACTION);

    resetStretchPlanCache();
    const noConsentStretch = await runLocalAsk(
      "stretch my trip",
      ctx({
        culturalProfile: { ...consentedProfile, consent: { granted: false, grantedAt: null } },
        searchPlaces,
      })
    );
    expect(noConsentStretch.stretchPlan?.kind).toBe("needs_consent");
    expect(naviMessageAction(noConsentStretch.message)).toBe(NAVI_OPEN_PROFILE_ACTION);
  });

  it("keeps messages without the field working and points the button to /app/profile", () => {
    const legacy = {
      id: "old",
      role: "assistant" as const,
      content: "You don't have a Cultural DNA profile yet.",
      timestamp: "2026-10-01T00:00:00.000Z",
    };
    expect(naviMessageAction(legacy)).toBeUndefined();
    expect(naviMessageAction(undefined)).toBeUndefined();
    expect(
      naviMessageAction(withNaviMessageAction(legacy, NAVI_OPEN_PROFILE_ACTION))
    ).toBe(NAVI_OPEN_PROFILE_ACTION);
    expect(withNaviMessageAction(legacy, undefined)).not.toHaveProperty("action");
    expect(naviActionFromToolData("getDailyBudget", { dailySafeSpend: 40 })).toBeUndefined();
    expect(NAVI_PROFILE_HREF).toBe("/app/profile");
    expect(t("en", "navi.action.choose_tastes")).toBe("Choose my tastes");
    expect(t("es", "navi.action.choose_tastes")).toBe("Elegir mis gustos");
    expect(t("pt", "navi.action.choose_tastes")).toBe("Escolher meus gostos");
  });

  it("keeps Why and Better without a last rec free of the button", async () => {
    const why = await runLocalAsk("why this?", ctx());
    expect(naviMessageAction(why.message)).toBeUndefined();
    const better = await runLocalAsk("find me a better option", ctx());
    expect(naviMessageAction(better.message)).toBeUndefined();
  });
});
