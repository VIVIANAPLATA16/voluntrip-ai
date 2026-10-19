import type { AgentMessage, PurchaseSimulation } from "@/types";
import type { Experience } from "@/lib/experiences";
import type { QlooResult } from "@/lib/qloo/types";

export interface ExperienceRecommendationPayload {
  best: Experience | null;
  alternative: Experience | null;
  usedBaseline: boolean;
  baselineLabel?: string;
  missingProfile: boolean;
  missingConsent: boolean;
  qlooSource: QlooResult["source"] | "skipped";
  reason?: string;
}

export interface NaviResponse {
  message: AgentMessage;
  simulation?: PurchaseSimulation;
  pendingTransaction?: unknown;
  mutations: Array<{ type: string; payload: unknown }>;
  experienceRecommendation?: ExperienceRecommendationPayload | null;
}
