import type { Pocket, Transaction, Trip } from "@/types";
import { buildBudgetSnapshot } from "@/lib/finance/budget";
import { calculateMoneyRunway } from "@/lib/finance/runway";
import type { QlooPlace } from "@/lib/qloo/types";
import { estimateExperienceCost } from "./costEstimate";
import {
  contextFit,
  culturalFit,
  financialFit,
  matchedProfileTags,
  purchaseSimulationForCost,
  valueScore,
  type FinancialContext,
} from "./evaluate";
import type {
  Experience,
  ExperienceIntent,
  ExperienceSource,
  RankedExperiences,
} from "./types";

export interface RankExperiencesInput {
  candidates: QlooPlace[];
  source: ExperienceSource;
  queriedAt: string;
  qlooTotal?: number;
  /** Labels of Cultural DNA signals sent to Qloo for this query. */
  signals?: readonly string[];
  profileTagIds: readonly string[];
  intent: ExperienceIntent;
  trip: Trip;
  transactions: Transaction[];
  pockets: Pocket[];
  now?: Date;
}

export function rankExperiences(input: RankExperiencesInput): RankedExperiences {
  const now = input.now ?? new Date();
  const finance: FinancialContext = {
    trip: input.trip,
    transactions: input.transactions,
    pockets: input.pockets,
    now,
  };
  const snapshot = buildBudgetSnapshot(
    input.trip,
    input.transactions,
    input.pockets,
    now
  );
  const runway = calculateMoneyRunway(input.trip, snapshot, now);
  const total = input.qlooTotal ?? input.candidates.length;

  const all: Experience[] = input.candidates.map((candidate) => {
    const estimatedCost = estimateExperienceCost(candidate);
    const cultural = culturalFit(
      candidate,
      input.profileTagIds,
      candidate.rank,
      total,
      input.source
    );
    const financial = financialFit(estimatedCost.amount, snapshot, finance);
    const context = contextFit(candidate, input.intent);
    const sim = purchaseSimulationForCost(estimatedCost.amount, finance);

    const experience: Experience = {
      id: candidate.id,
      name: candidate.name,
      tags: candidate.tags,
      popularity: candidate.popularity,
      priceLevel: candidate.priceLevel,
      source: input.source,
      estimatedCost,
      culturalFit: cultural,
      financialFit: financial,
      contextFit: context,
      // Voluntrip Value Score — not a Qloo metric.
      valueScore: valueScore(cultural, financial, context),
      whyQloo: {
        matchedTags: matchedProfileTags(candidate, input.profileTagIds),
        rank: candidate.rank,
        source: input.source,
        queriedAt: input.queriedAt,
        signals: [...(input.signals ?? [])],
        totalResults: total,
      },
      whyVoluntrip: {
        estimatedCost,
        dailySafeSpendBefore: sim.dailyBudgetBefore,
        dailySafeSpendAfter: sim.dailyBudgetAfter,
        protectedMoneyUntouched: sim.affordable,
        runwayStatus: runway.status,
      },
    };

    if (candidate.neighborhood) experience.neighborhood = candidate.neighborhood;
    if (candidate.address) experience.address = candidate.address;
    return experience;
  });

  all.sort((a, b) => {
    if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
    return a.estimatedCost.amount - b.estimatedCost.amount;
  });

  const best = all.find((experience) => experience.financialFit > 0) ?? null;
  const alternative = pickAlternative(all, best);

  return { best, alternative, all };
}

function pickAlternative(
  all: Experience[],
  best: Experience | null
): Experience | null {
  if (!best) return null;
  const cheaperFits = all.filter(
    (experience) =>
      experience.id !== best.id &&
      experience.culturalFit >= 60 &&
      experience.estimatedCost.amount < best.estimatedCost.amount
  );
  if (cheaperFits.length === 0) return null;
  return cheaperFits.reduce((cheapest, current) =>
    current.estimatedCost.amount < cheapest.estimatedCost.amount ? current : cheapest
  );
}
