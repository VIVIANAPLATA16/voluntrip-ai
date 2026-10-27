import type { AgentMessage, PurchaseSimulation } from "@/types";
import type { Experience, StretchPlanResult } from "@/lib/experiences";
import type { MyDayPlan } from "./myDayPlan";
import type { QlooResult } from "@/lib/qloo/types";

export const NAVI_PROFILE_HREF = "/app/profile";
export const NAVI_OPEN_PROFILE_ACTION = "open_profile" as const;
export type NaviMessageAction = typeof NAVI_OPEN_PROFILE_ACTION;

export type NaviAgentMessage = AgentMessage & {
  action?: NaviMessageAction;
};

export function naviMessageAction(
  message: AgentMessage | NaviAgentMessage | null | undefined
): NaviMessageAction | undefined {
  if (!message) return undefined;
  return (message as NaviAgentMessage).action === NAVI_OPEN_PROFILE_ACTION
    ? NAVI_OPEN_PROFILE_ACTION
    : undefined;
}

export function withNaviMessageAction(
  message: AgentMessage,
  action: NaviMessageAction | undefined
): AgentMessage {
  const next: NaviAgentMessage = { ...message };
  if (action) {
    next.action = action;
    return next;
  }
  delete next.action;
  return next;
}

export function naviActionFromToolData(
  name: string,
  data: unknown
): NaviMessageAction | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as {
    missingProfile?: unknown;
    missingConsent?: unknown;
    kind?: unknown;
  };
  if (
    name === "recommendExperience" ||
    name === "explainRecommendation" ||
    name === "findBetterOption"
  ) {
    if (record.missingProfile === true || record.missingConsent === true) {
      return NAVI_OPEN_PROFILE_ACTION;
    }
  }
  if (name === "planMyDay") {
    if (record.kind === "needs_profile" || record.kind === "needs_consent") {
      return NAVI_OPEN_PROFILE_ACTION;
    }
  }
  if (name === "planStretch" && record.kind === "needs_consent") {
    return NAVI_OPEN_PROFILE_ACTION;
  }
  return undefined;
}

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
