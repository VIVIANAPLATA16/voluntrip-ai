import { NextResponse } from "next/server";
import type { AgentMessage } from "@/types";
import type { NaviResponse } from "@/lib/agent/types";
import type { AgentContext } from "@/lib/agent/tools";
import { attachAffordSimulation } from "@/lib/agent/affordSimulation";
import { runLocalAsk } from "@/lib/agent/localAsk";
import { alignDemoTripForBudget, resolveBudgetNow } from "@/lib/demo/remainingDays";
import { searchQlooPlaces } from "@/lib/qloo/client";
import {
  callAzureOpenAI,
  generateInsight,
  isServerMockMode,
} from "@/lib/ai/azureOpenAI.server";
import { processFinancialInput } from "@/lib/ai/azureOpenAI";
import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * Server route for NAVI / Azure OpenAI.
 * Keeps secrets off the client.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      text?: string;
      context?: string;
      messages?: AgentMessage[];
      tripContext?: AgentContext;
      status?: string;
      dailySpend?: number;
      safeDaily?: number;
      locale?: Locale;
    };

    switch (body.action) {
      case "ask": {
        const text = body.text || "";
        const messages = body.messages ?? [];
        const incoming = body.tripContext;
        const now = resolveBudgetNow(incoming?.trip, incoming?.now);
        const tripContext: AgentContext = {
          pockets: [],
          transactions: [],
          goals: [],
          locale: "en",
          ...incoming,
          now,
          trip: incoming?.trip ? alignDemoTripForBudget(incoming.trip, now) : null,
          searchPlaces: searchQlooPlaces,
        };

        let result: NaviResponse;

        if (isServerMockMode()) {
          // Heuristic fallback only — not a full LLM. Set MOCK_AI=false + Azure for real answers.
          result = await runLocalAsk(text, tripContext);
        } else {
          try {
            result = await callAzureOpenAI({
              userText: text,
              messages,
              tripContext,
            });
          } catch (azureError) {
            const message =
              azureError instanceof Error ? azureError.message : "Azure OpenAI failed";
            return NextResponse.json({ error: message }, { status: 503 });
          }
        }

        return NextResponse.json(attachAffordSimulation(text, tripContext, result));
      }
      case "process": {
        const result = await processFinancialInput(body.text || "");
        return NextResponse.json(result);
      }
      case "insight": {
        const result = await generateInsight(
          body.status || "on_track",
          body.dailySpend || 0,
          body.safeDaily || 0,
          body.locale || "en"
        );
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed" },
      { status: 500 }
    );
  }
}
