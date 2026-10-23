import type { PurchaseSimulation } from "@/types";
import { formatMoney } from "@/lib/constants";
import { t } from "@/lib/i18n/dictionaries";
import type { NaviResponse } from "./types";
import { detectLocalAskIntent, parseAmountCurrency } from "./localAsk";
import { formatExperiencePlaceLabel, extractPlaceFromWhatIf } from "./purchaseLabel";
import { naviQlooCite } from "./qlooVoice";
import { simulationReply } from "./simulationReply";
import { applyMyDayToNaviResponse } from "./experienceReply";
import type { MyDayPlan } from "./myDayPlan";
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
  const dayCall = response.message.toolCalls?.find(function (call) {
    return call.name === "planMyDay" && call.result;
  });
  if (dayCall?.result && (dayCall.result as MyDayPlan).kind) {
    response = applyMyDayToNaviResponse(ctx.locale, response, dayCall.result as MyDayPlan);
  }

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

  const base = ctx.trip?.baseCurrency || "USD";
  const budget = simulation
    ? simulationReply(ctx.locale, simulation, base)
    : response.message.content;
  const placeLine = affordQlooLead(ctx, userText, simulation);
  const content = [placeLine, budget].filter(Boolean).join("\n\n");

  return {
    ...response,
    simulation,
    pendingTransaction: undefined,
    mutations: (response.mutations ?? []).filter(function (mutation) {
      return mutation.type !== "transaction";
    }),
    message: {
      ...response.message,
      content,
    },
  };
}

function affordQlooLead(
  ctx: AgentContext,
  userText: string,
  simulation?: PurchaseSimulation
): string {
  const best = ctx.lastRecommendation?.best;
  if (!best || !simulation) return "";
  const askedPlace = extractPlaceFromWhatIf(userText);
  if (!askedPlace) return "";
  const recPlace = formatExperiencePlaceLabel(best);
  const placeMatches = Boolean(
    recPlace && askedPlace.toLowerCase() === recPlace.toLowerCase()
  );
  const nameMatches = askedPlace.toLowerCase() === best.name.toLowerCase();
  if (!placeMatches && !nameMatches) return "";

  const cite = naviQlooCite(ctx.locale, best, Boolean(ctx.lastRecommendation?.usedBaseline));
  const cost = t(ctx.locale, "navi.experience.estimated_cost", {
    cost: formatMoney(simulation.purchaseAmount, simulation.purchaseCurrency, {
      showCode: true,
    }),
  });
  return [cite.text, cost].join("\n");
}
