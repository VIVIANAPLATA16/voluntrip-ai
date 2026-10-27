import type { CulturalProfile } from "@/types";
import {
  getConsentedFilterTagId,
  getConsentedLovedEntities,
  getConsentedQlooTagIds,
} from "@/lib/culture/profile";
import {
  GENERIC_BASELINE_LABEL,
  clampStretchNights,
  discoverExperiences,
  rankExperiences,
  rankMedellinBaseline,
  requestStretchPlan,
} from "@/lib/experiences";
import {
  MY_DAY_MIN_QLOO,
  dayPlanConcept,
  dayPlanTotal,
  distinctByFoldedName,
  pickDayStops,
  type MyDayPlan,
} from "./myDayPlan";
import type { ExperienceIntent } from "@/lib/experiences";
import { fetchQlooPlaces } from "@/lib/qloo/apiFetch";
import type { QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import { alignDemoTripForBudget, resolveBudgetNow } from "@/lib/demo/remainingDays";
import type { AgentContext, ToolName, ToolResult } from "./tools";
import { executeTool } from "./tools";
import type { ExperienceRecommendationPayload } from "./types";

export const CULTURAL_TOOL_NAMES = [
  "recommendExperience",
  "explainRecommendation",
  "findBetterOption",
  "planStretch",
  "planMyDay",
] as const;

export type CulturalToolName = (typeof CULTURAL_TOOL_NAMES)[number];

export function isCulturalTool(name: ToolName): name is CulturalToolName {
  return (CULTURAL_TOOL_NAMES as readonly string[]).includes(name);
}

export type { ExperienceRecommendationPayload };

function noMutation(data: unknown): ToolResult {
  return { ok: true, data, mutation: { type: "none" } };
}

function resolveSearchPlaces(
  ctx: AgentContext
): (query: QlooPlaceQuery) => Promise<QlooResult> {
  return ctx.searchPlaces ?? fetchQlooPlaces;
}

function intentFromArgs(args: Record<string, unknown>): ExperienceIntent {
  return args.intent === "general" ? "general" : "tonight";
}

function hasConsent(profile: CulturalProfile | null | undefined): boolean {
  return Boolean(profile?.consent.granted);
}

function foldCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isMedellinCity(city: string): boolean {
  return foldCity(city) === "medellin";
}

function emptyRecommendation(
  fields: Pick<ExperienceRecommendationPayload, "missingProfile" | "missingConsent" | "qlooSource"> & {
    reason?: string;
    emptyFilter?: boolean;
    filterLabel?: string;
  }
): ExperienceRecommendationPayload {
  return {
    best: null,
    alternative: null,
    usedBaseline: false,
    ...fields,
  };
}

export async function recommendExperience(
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<ToolResult> {
  if (!ctx.trip) return { ok: false, error: "No active trip", mutation: { type: "none" } };

  const city = String(args.city || ctx.trip.city || "").trim();
  if (!city) return { ok: false, error: "city is required", mutation: { type: "none" } };

  const intent = intentFromArgs(args);
  const profile = ctx.culturalProfile ?? null;
  const missingProfile = profile == null;
  const missingConsent = !hasConsent(profile);
  const now = resolveBudgetNow(ctx.trip, ctx.now);
  const trip = alignDemoTripForBudget(ctx.trip, now);

  const rankInput = {
    profileTagIds: getConsentedQlooTagIds(profile),
    intent,
    trip,
    transactions: ctx.transactions,
    pockets: ctx.pockets,
    now,
  };

  if (missingProfile || missingConsent) {
    if (isMedellinCity(ctx.trip.city)) {
      const ranked = rankMedellinBaseline(rankInput);
      return noMutation({
        best: ranked.best,
        alternative: ranked.alternative,
        usedBaseline: true,
        baselineLabel: GENERIC_BASELINE_LABEL,
        missingProfile,
        missingConsent,
        qlooSource: "skipped",
      } satisfies ExperienceRecommendationPayload);
    }
    return noMutation(
      emptyRecommendation({
        missingProfile,
        missingConsent,
        qlooSource: "skipped",
      })
    );
  }

  const filterTagId = getConsentedFilterTagId(profile);
  const loved = getConsentedLovedEntities(profile);
  const discovered = await discoverExperiences(
    {
      city,
      profileTagIds: rankInput.profileTagIds,
      filterTagId,
      entityIds: loved.map(function (entity) {
        return entity.id;
      }),
      entityNames: loved.map(function (entity) {
        return entity.name;
      }),
      consentGranted: true,
    },
    { searchPlaces: resolveSearchPlaces(ctx), now }
  );

  if (discovered.source !== "qloo") {
    if (isMedellinCity(ctx.trip.city)) {
      const ranked = rankMedellinBaseline(rankInput);
      return noMutation({
        best: ranked.best,
        alternative: ranked.alternative,
        usedBaseline: true,
        baselineLabel: GENERIC_BASELINE_LABEL,
        missingProfile: false,
        missingConsent: false,
        qlooSource: discovered.source,
        reason: discovered.reason,
      } satisfies ExperienceRecommendationPayload);
    }
    return noMutation(
      emptyRecommendation({
        missingProfile: false,
        missingConsent: false,
        qlooSource: discovered.source,
        reason: discovered.reason,
      })
    );
  }

  if (discovered.candidates.length === 0) {
    return noMutation(
      emptyRecommendation({
        missingProfile: false,
        missingConsent: false,
        qlooSource: "qloo",
        emptyFilter: Boolean(discovered.filter),
        filterLabel: discovered.filter,
      })
    );
  }

  const ranked = rankExperiences({
    ...rankInput,
    candidates: discovered.candidates,
    source: "qloo",
    queriedAt: discovered.queriedAt,
    qlooTotal: discovered.qlooTotal,
    signals: discovered.signals,
    filter: discovered.filter,
    entities: discovered.entities,
  });

  return noMutation({
    best: ranked.best,
    alternative: ranked.alternative,
    usedBaseline: false,
    missingProfile: false,
    missingConsent: false,
    qlooSource: "qloo",
    emptyFilter: false,
    filterLabel: discovered.filter,
  } satisfies ExperienceRecommendationPayload);
}

export function explainRecommendation(
  _args: Record<string, unknown>,
  ctx: AgentContext
): ToolResult {
  const last = ctx.lastRecommendation;
  if (!last?.best) {
    return noMutation({
      missing: true,
      best: null,
      alternative: last?.alternative ?? null,
      missingProfile: Boolean(last?.missingProfile),
      missingConsent: Boolean(last?.missingConsent),
    });
  }
  return noMutation({
    missing: false,
    best: last.best,
    alternative: last.alternative,
    whyQloo: last.best.whyQloo,
    whyVoluntrip: last.best.whyVoluntrip,
    usedBaseline: last.usedBaseline,
    baselineLabel: last.baselineLabel,
    qlooSource: last.qlooSource,
    missingProfile: Boolean(last.missingProfile),
    missingConsent: Boolean(last.missingConsent),
  });
}

export function findBetterOption(
  _args: Record<string, unknown>,
  ctx: AgentContext
): ToolResult {
  const last = ctx.lastRecommendation;
  if (!last) {
    return noMutation({
      missing: true,
      alternative: null,
      missingProfile: false,
      missingConsent: false,
    });
  }
  return noMutation({
    missing: false,
    alternative: last.alternative,
    best: last.best,
    usedBaseline: last.usedBaseline,
    baselineLabel: last.baselineLabel,
    missingProfile: Boolean(last.missingProfile),
    missingConsent: Boolean(last.missingConsent),
  });
}

export async function planStretch(
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<ToolResult> {
  if (!ctx.trip) return { ok: false, error: "No active trip", mutation: { type: "none" } };
  const city = String(args.city || ctx.trip.city || "").trim();
  if (!city) return { ok: false, error: "city is required", mutation: { type: "none" } };
  const now = resolveBudgetNow(ctx.trip, ctx.now);
  const trip = alignDemoTripForBudget(ctx.trip, now);
  const result = await requestStretchPlan({
    city,
    nights: clampStretchNights(args.nights),
    trip,
    transactions: ctx.transactions,
    pockets: ctx.pockets,
    culturalProfile: ctx.culturalProfile ?? null,
    searchPlaces: resolveSearchPlaces(ctx),
    now,
  });
  return noMutation(result);
}

export async function planMyDay(
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<ToolResult> {
  if (!ctx.trip) return { ok: false, error: "No active trip", mutation: { type: "none" } };
  const city = String(args.city || ctx.trip.city || "").trim();
  if (!city) return { ok: false, error: "city is required", mutation: { type: "none" } };

  const now = resolveBudgetNow(ctx.trip, ctx.now);
  const trip = alignDemoTripForBudget(ctx.trip, now);
  const dailyResult = executeTool("getDailyBudget", {}, { ...ctx, trip, now });
  const dailySafe = Number(
    (dailyResult.data as { dailySafeSpend?: number } | undefined)?.dailySafeSpend ?? 0
  );
  const currency = trip.baseCurrency;
  const honest = {
    city,
    dailySafe,
    currency,
  };

  const profile = ctx.culturalProfile ?? null;
  const missingProfile = profile == null;
  const missingConsent = !hasConsent(profile);
  if (missingProfile) {
    return noMutation({ kind: "needs_profile", ...honest } satisfies MyDayPlan);
  }
  if (missingConsent) {
    return noMutation({ kind: "needs_consent", ...honest } satisfies MyDayPlan);
  }

  const loved = getConsentedLovedEntities(profile);
  const discovered = await discoverExperiences(
    {
      city,
      profileTagIds: getConsentedQlooTagIds(profile),
      filterTagId: getConsentedFilterTagId(profile),
      entityIds: loved.map(function (entity) {
        return entity.id;
      }),
      entityNames: loved.map(function (entity) {
        return entity.name;
      }),
      consentGranted: true,
    },
    { searchPlaces: resolveSearchPlaces(ctx), now }
  );

  if (discovered.source === "unavailable") {
    return noMutation({
      kind: "unavailable",
      ...honest,
      reason: discovered.reason,
    } satisfies MyDayPlan);
  }
  if (discovered.source !== "qloo") {
    return noMutation({ kind: "demo", ...honest } satisfies MyDayPlan);
  }

  const unique = distinctByFoldedName(
    rankExperiences({
      profileTagIds: getConsentedQlooTagIds(profile),
      intent: "general",
      trip,
      transactions: ctx.transactions,
      pockets: ctx.pockets,
      now,
      candidates: discovered.candidates,
      source: "qloo",
      queriedAt: discovered.queriedAt,
      qlooTotal: discovered.qlooTotal,
      signals: discovered.signals,
      filter: discovered.filter,
      entities: discovered.entities,
    }).all
  );

  if (unique.length < MY_DAY_MIN_QLOO) {
    return noMutation({
      kind: unique.length === 0 ? "empty" : "too_few",
      ...honest,
      found: unique.length,
    } satisfies MyDayPlan);
  }

  const stops = pickDayStops(unique, dailySafe);
  if (stops.length === 0) {
    return noMutation({ kind: "none_fit", ...honest } satisfies MyDayPlan);
  }

  const total = dayPlanTotal(stops);
  const simResult = executeTool(
    "simulatePurchase",
    { amount: total, currency: trip.baseCurrency },
    { ...ctx, trip, now }
  );
  if (!simResult.ok || !simResult.data) {
    return noMutation({ kind: "none_fit", ...honest } satisfies MyDayPlan);
  }

  return noMutation({
    kind: "ready",
    city,
    stops,
    total,
    dailySafe,
    simulation: simResult.data as import("@/types").PurchaseSimulation,
    concept: dayPlanConcept(ctx.locale, stops),
  } satisfies MyDayPlan);
}

export async function executeToolAsync(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<ToolResult> {
  switch (name) {
    case "recommendExperience":
      return recommendExperience(args, ctx);
    case "explainRecommendation":
      return explainRecommendation(args, ctx);
    case "findBetterOption":
      return findBetterOption(args, ctx);
    case "planStretch":
      return planStretch(args, ctx);
    case "planMyDay":
      return planMyDay(args, ctx);
    default:
      return executeTool(name, args, ctx);
  }
}
