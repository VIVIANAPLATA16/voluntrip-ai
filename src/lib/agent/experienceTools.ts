import type { CulturalProfile } from "@/types";
import { getConsentedQlooTagIds } from "@/lib/culture/profile";
import {
  GENERIC_BASELINE_LABEL,
  discoverExperiences,
  rankExperiences,
  rankMedellinBaseline,
} from "@/lib/experiences";
import type { ExperienceIntent } from "@/lib/experiences";
import { fetchQlooPlaces } from "@/lib/qloo/apiFetch";
import type { QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
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
  const now = ctx.now ?? new Date();

  const rankInput = {
    profileTagIds: getConsentedQlooTagIds(profile),
    intent,
    trip: ctx.trip,
    transactions: ctx.transactions,
    pockets: ctx.pockets,
    now,
  };

  if (missingProfile || missingConsent) {
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

  const discovered = await discoverExperiences(
    {
      city,
      profileTagIds: rankInput.profileTagIds,
      consentGranted: true,
    },
    { searchPlaces: resolveSearchPlaces(ctx), now }
  );

  if (discovered.source !== "qloo") {
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

  const ranked = rankExperiences({
    ...rankInput,
    candidates: discovered.candidates,
    source: "qloo",
    queriedAt: discovered.queriedAt,
    qlooTotal: discovered.qlooTotal,
    signals: discovered.signals,
  });

  return noMutation({
    best: ranked.best,
    alternative: ranked.alternative,
    usedBaseline: false,
    missingProfile: false,
    missingConsent: false,
    qlooSource: "qloo",
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
