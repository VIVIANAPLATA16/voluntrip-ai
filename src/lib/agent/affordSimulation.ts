import type { PurchaseSimulation } from "@/types";
import type { NaviResponse } from "./types";
import { detectLocalAskIntent, parseAmountCurrency } from "./localAsk";
import { executeTool, type AgentContext } from "./tools";

function wantsPurchaseSimulation(userText: string): boolean {
  const { intent } = detectLocalAskIntent(userText);
  if (intent === "afford") return true;
  return /simulate this estimate|simular este|simular esta/i.test(userText);
}

/** Always attach Confirm/Cancel simulation for what-if spend. Never records a transaction. */
export function attachAffordSimulation(
  userText: string,
  ctx: AgentContext,
  response: NaviResponse
): NaviResponse {
  if (!wantsPurchaseSimulation(userText)) return response;

  let simulation = response.simulation;
  if (!simulation) {
    const fromTool = response.message.toolCalls?.find(function (call) {
      return call.name === "simulatePurchase" && call.result;
    });
    if (fromTool?.result) simulation = fromTool.result as PurchaseSimulation;
  }

  if (!simulation) {
    const parsed = parseAmountCurrency(userText);
    if (parsed && ctx.trip) {
      const result = executeTool(
        "simulatePurchase",
        { amount: parsed.amount, currency: parsed.currency || ctx.trip.baseCurrency },
        ctx
      );
      if (result.ok) simulation = result.data as PurchaseSimulation;
    }
  }

  return {
    ...response,
    simulation,
    pendingTransaction: undefined,
    mutations: (response.mutations ?? []).filter(function (mutation) {
      return mutation.type !== "transaction";
    }),
  };
}
