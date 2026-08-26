import type { AgentMessage, AgentToolCall, PurchaseSimulation, Transaction } from "@/types";
import { createId } from "@/lib/id";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { NaviResponse } from "./types";
import type { AgentContext, ToolName, ToolResult } from "./tools";
import { makeToolCall } from "./tools";

export interface ExecutedTool {
  name: ToolName;
  args: Record<string, unknown>;
  result: ToolResult;
}

export function buildNaviResponse(params: {
  userText: string;
  assistantContent: string;
  executedTools: ExecutedTool[];
  locale: "en" | "es" | "pt";
}): NaviResponse {
  const toolCalls: AgentToolCall[] = params.executedTools.map(({ name, args, result }) =>
    makeToolCall(name, args, result)
  );

  const mutations: NaviResponse["mutations"] = [];
  let simulation: PurchaseSimulation | undefined;
  let pendingTransaction: Transaction | undefined;

  for (const { name, result } of params.executedTools) {
    if (!result.ok || !result.mutation || result.mutation.type === "none") continue;

    if (name === "simulatePurchase" && result.data) {
      simulation = result.data as PurchaseSimulation;
      continue;
    }

    if (name === "createTransaction" && result.mutation.payload) {
      pendingTransaction = result.mutation.payload as Transaction;
      continue;
    }

    if (result.mutation.payload) {
      mutations.push({
        type: result.mutation.type,
        payload: result.mutation.payload,
      });
    }
  }

  const assistantMsg: AgentMessage = {
    id: createId(),
    role: "assistant",
    content: params.assistantContent,
    timestamp: new Date().toISOString(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    locale: params.locale,
  };

  return {
    message: assistantMsg,
    simulation,
    pendingTransaction,
    mutations,
  };
}

export function buildConnectionErrorResponse(
  locale: Locale,
  detail?: string
): NaviResponse {
  const detailSuffix = detail ? ` (${detail})` : "";
  return {
    message: {
      id: createId(),
      role: "assistant",
      content: t(locale, "navi.connection_error", { detail: detailSuffix }),
      timestamp: new Date().toISOString(),
      locale,
    },
    mutations: [],
  };
}

/** Serialize trip context for the system prompt (server-side). */
export function tripContextSummary(ctx: AgentContext): string {
  if (!ctx.trip) {
    return `\n\nNo active trip.\nUser locale: ${ctx.locale}.`;
  }
  const t = ctx.trip;
  return `\n\nActive trip: ${t.city}, ${t.country} (${t.flag}).
Base currency: ${t.baseCurrency}. Local currency: ${t.localCurrency}.
Trip dates: ${t.startDate} → ${t.endDate}.
Initial budget: ${t.initialBudget} ${t.baseCurrency}.
Pockets: ${ctx.pockets.length}. Transactions: ${ctx.transactions.length}. Goals: ${ctx.goals.length}.
User locale: ${ctx.locale}.`;
}
