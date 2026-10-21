import type { AgentMessage } from "@/types";
import { createId } from "@/lib/id";
import { runLocalAsk } from "./localAsk";
import { buildConnectionErrorResponse } from "./responseBuilder";
import type { AgentContext } from "./tools";
import { AgentMemory } from "./memory";
import type { StretchPlanResult } from "@/lib/experiences";
import type { ExperienceRecommendationPayload, NaviResponse } from "./types";

export type { NaviResponse } from "./types";

function shouldUseRemoteNavi(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_AI === "false";
}

export class NaviAgent {
  memory = new AgentMemory();
  lastRecommendation: ExperienceRecommendationPayload | null = null;
  lastStretchPlan: StretchPlanResult | null = null;

  async ask(userText: string, ctx: AgentContext): Promise<NaviResponse> {
    const locale = ctx.locale;
    const userMsg: AgentMessage = {
      id: createId(),
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
      locale,
    };
    this.memory.add(userMsg);

    const ctxWithSession: AgentContext = {
      ...ctx,
      lastRecommendation: ctx.lastRecommendation ?? this.lastRecommendation,
    };

    if (shouldUseRemoteNavi()) {
      return this.askRemote(userText, ctxWithSession, locale);
    }

    // Client-side mock: heuristic only. Full conversational NAVI needs NEXT_PUBLIC_MOCK_AI=false + Azure.
    const result = await runLocalAsk(userText, ctxWithSession);
    this.rememberRecommendation(result);
    this.memory.add(result.message);
    return result;
  }

  private rememberRecommendation(result: NaviResponse) {
    if (result.experienceRecommendation !== undefined) {
      this.lastRecommendation = result.experienceRecommendation;
    }
    if (result.stretchPlan !== undefined) {
      this.lastStretchPlan = result.stretchPlan;
    }
  }

  private async askRemote(
    userText: string,
    ctx: AgentContext,
    locale: AgentContext["locale"]
  ): Promise<NaviResponse> {
    try {
      const res = await fetch("/api/navi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          text: userText,
          messages: this.memory.all(),
          tripContext: {
            trip: ctx.trip,
            pockets: ctx.pockets,
            transactions: ctx.transactions,
            goals: ctx.goals,
            locale: ctx.locale,
            now: ctx.now instanceof Date ? ctx.now.toISOString() : ctx.now,
            culturalProfile: ctx.culturalProfile ?? null,
            lastRecommendation: ctx.lastRecommendation ?? this.lastRecommendation,
          },
        }),
      });

      const data = (await res.json()) as NaviResponse & { error?: string };

      if (!res.ok) {
        const detail = data.error || res.statusText;
        const errorResponse = buildConnectionErrorResponse(locale, detail);
        this.memory.add(errorResponse.message);
        return errorResponse;
      }

      this.memory.add(data.message);
      const result: NaviResponse = {
        message: data.message,
        simulation: data.simulation,
        pendingTransaction: data.pendingTransaction,
        mutations: data.mutations ?? [],
        experienceRecommendation: data.experienceRecommendation,
        stretchPlan: data.stretchPlan,
      };
      this.rememberRecommendation(result);
      return result;
    } catch (err) {
      const detail = err instanceof Error ? err.message : undefined;
      const errorResponse = buildConnectionErrorResponse(locale, detail);
      this.memory.add(errorResponse.message);
      return errorResponse;
    }
  }
}

export const naviAgent = new NaviAgent();
