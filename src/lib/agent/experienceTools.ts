import type { CulturalProfile } from "@/types";
import { getConsentedFilterTagId, getConsentedQlooTagIds } from "@/lib/culture/profile";
import {
  GENERIC_BASELINE_LABEL,
  discoverExperiences,
  rankExperiences,
  rankMedellinBaseline,
} from "@/lib/experiences";
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
  const discovered = await discoverExperiences(
    {
      city,
      profileTagIds: rankInput.profileTagIds,
      filterTagId,
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
  });
}

export function findBetterOption(
  _args: Record<string, unknown>,
  ctx: AgentContext
): ToolResult {
  const last = ctx.lastRecommendation;
  if (!last) {
    return noMutation({ missing: true, alternative: null });
  }
  return noMutation({
    missing: false,
    alternative: last.alternative,
    best: last.best,
    usedBaseline: last.usedBaseline,
    baselineLabel: last.baselineLabel,
  });
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
    default:
      return executeTool(name, args, ctx);
  }
}
