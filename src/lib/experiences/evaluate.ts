/**
 * Voluntrip Value Score — owned by Voluntrip, never a Qloo score.
 *
 *   valueScore = 0.40 * culturalFit
 *              + 0.35 * financialFit
 *              + 0.25 * contextFit
 *
 * Qloo supplies cultural ranking/tags. Finance and context are Voluntrip's.
 */

import type { QlooPlace } from "@/lib/qloo/types";
import type { BudgetSnapshot, Pocket, Transaction, Trip } from "@/types";
import { simulatePurchase } from "@/lib/finance/simulation";
import type { ExperienceIntent, ExperienceSource } from "./types";

export interface FinancialContext {
  trip: Trip;
  transactions: Transaction[];
  pockets: Pocket[];
  now?: Date;
}

export function purchaseSimulationForCost(
  estimatedCost: number,
  context: FinancialContext
) {
  return simulatePurchase(
    context.trip,
    context.transactions,
    context.pockets,
    estimatedCost,
    "USD",
    context.now
  );
}

/**
 * 0 if the amount exceeds real available money or would touch protected money
 * (`simulatePurchase().affordable === false`).
 * Otherwise 100 while cost ≤ 50% of daily safe spend, linearly down to 0 at 200%.
 */
export function financialFit(
  estimatedCost: number,
  snapshot: BudgetSnapshot,
  context: FinancialContext
): number {
  const sim = purchaseSimulationForCost(estimatedCost, context);
  if (!sim.affordable || estimatedCost > snapshot.realAvailable) return 0;

  const daily = snapshot.dailySafeSpend;
  if (daily <= 0) return 0;

  const ratio = estimatedCost / daily;
  if (ratio <= 0.5) return 100;
  if (ratio >= 2) return 0;
  return clampScore((100 * (2 - ratio)) / 1.5);
}

/**
 * 60% Qloo rank position `(total - rank) / (total - 1)`,
 * 40% share of profile tag IDs present on the candidate.
 * Non-Qloo sources always score 0 — never treat demo/unavailable as live affinity.
 */
export function culturalFit(
  candidate: Pick<QlooPlace, "tags">,
  profileTagIds: readonly string[],
  rank: number,
  total: number,
  source: ExperienceSource
): number {
  if (source !== "qloo") return 0;

  const rankScore = total <= 1 ? 1 : (total - rank) / Math.max(total - 1, 1);
  const tags = new Set(candidate.tags.map((tag) => tag.id));
  const profile = profileTagIds.map((id) => id.trim()).filter(Boolean);
  const tagScore =
    profile.length === 0
      ? 0
      : profile.filter((id) => tags.has(id)).length / profile.length;

  return clampScore(100 * (0.6 * clamp01(rankScore) + 0.4 * clamp01(tagScore)));
}

/**
 * Tonight: score rises when the candidate already has nightlife or
 * `time_of_day_fit:qloo:evening` tags. Opening hours are never invented.
 */
export function contextFit(
  candidate: Pick<QlooPlace, "tags">,
  intent: ExperienceIntent
): number {
  if (intent !== "tonight") return 50;

  const ids = candidate.tags.map((tag) => tag.id);
  const nightlife = ids.some((id) => id.includes("nightlife"));
  const evening = ids.some((id) => id.includes("time_of_day_fit:qloo:evening"));

  let score = 20;
  if (nightlife) score += 60;
  if (evening) score += 20;
  return clampScore(score);
}

export function valueScore(
  cultural: number,
  financial: number,
  context: number
): number {
  return clampScore(0.4 * cultural + 0.35 * financial + 0.25 * context);
}

export function matchedProfileTags(
  candidate: Pick<QlooPlace, "tags">,
  profileTagIds: readonly string[]
): string[] {
  const present = new Set(candidate.tags.map((tag) => tag.id));
  const seen = new Set<string>();
  const matched: string[] = [];
  for (const id of profileTagIds) {
    const tag = id.trim();
    if (!tag || seen.has(tag) || !present.has(tag)) continue;
    seen.add(tag);
    matched.push(tag);
  }
  return matched;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
