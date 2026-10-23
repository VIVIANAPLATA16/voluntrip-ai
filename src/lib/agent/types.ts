import type { AgentMessage, PurchaseSimulation } from "@/types";
import type { Experience, StretchPlanResult } from "@/lib/experiences";
import type { MyDayPlan } from "./myDayPlan";
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
  emptyFilter?: boolean;
  filterLabel?: string;
}

export interface NaviResponse {
  message: AgentMessage;
  simulation?: PurchaseSimulation;
  pendingTransaction?: unknown;
  mutations: Array<{ type: string; payload: unknown }>;
  experienceRecommendation?: ExperienceRecommendationPayload | null;
  stretchPlan?: StretchPlanResult | null;
  dayPlan?: MyDayPlan | null;
}
