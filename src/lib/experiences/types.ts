import type { CostEstimate } from "./costEstimate";
import type { QlooPlace, QlooResult, QlooUnavailableReason } from "@/lib/qloo/types";
import type { SpendingStatus } from "@/types";

export type ExperienceIntent = "tonight" | "general";

export type ExperienceSource = QlooResult["source"];

export interface WhyQloo {
  matchedTags: string[];
  rank: number;
  source: ExperienceSource;
  queriedAt: string;
  /** Cultural DNA labels sent as Qloo signals for this query. */
  signals: string[];
  /** How many place candidates Qloo returned (before hotel filter). */
  totalResults: number;
  /** Label of the hard Qloo filter.tags, when one was sent. */
  filter?: string;
  /** Readable names of loved entities sent as signal.interests.entities. */
  entities?: string[];
}

export interface WhyVoluntrip {
  estimatedCost: CostEstimate;
  dailySafeSpendBefore: number;
  dailySafeSpendAfter: number;
  protectedMoneyUntouched: boolean;
  runwayStatus: SpendingStatus;
}

/**
 * Ranked experience. `valueScore` is Voluntrip's, never a Qloo score.
 */
export interface Experience {
  id: string;
  name: string;
  neighborhood?: string;
  address?: string;
  tags: QlooPlace["tags"];
  popularity: number | null;
  priceLevel: QlooPlace["priceLevel"];
  source: ExperienceSource;
  estimatedCost: CostEstimate;
  culturalFit: number;
  financialFit: number;
  contextFit: number;
  valueScore: number;
  whyQloo: WhyQloo;
  whyVoluntrip: WhyVoluntrip;
}

export interface RankedExperiences {
  best: Experience | null;
  alternative: Experience | null;
  all: Experience[];
}

export interface DiscoveryResult {
  source: ExperienceSource;
  reason?: QlooUnavailableReason | "NO_KEY";
  queriedAt: string;
  candidates: QlooPlace[];
  qlooTotal: number;
  signals: string[];
  filter?: string;
  /** Readable names of loved entities sent with this query. */
  entities?: string[];
}
