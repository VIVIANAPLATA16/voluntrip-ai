import type { AgentToolCall, MoneyRunwayResult, PurchaseSimulation } from "@/types";
import { formatMoney } from "@/lib/constants";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { ExperienceRecommendationPayload, NaviResponse } from "./types";
import { buildNaviResponse } from "./responseBuilder";
import { formatExperienceToolReply } from "./experienceReply";
import { executeToolAsync, isCulturalTool } from "./experienceTools";
import type { AgentContext, ToolName } from "./tools";
import { executeTool, makeToolCall } from "./tools";

export function parseAmountCurrency(text: string): { amount: number; currency: string } | null {
  const patterns = [
    /\$\s?([\d,.]+)\s*(usd|dollars?)?/i,
    /([\d,.]+)\s*(usd|eur|gbp|thb|cop|brl|mxn|baht|euros?|reais?|dollars?)/i,
    /(฿|€|£)\s?([\d,.]+)/,
    /([\d,.]+)\s*(฿)/,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    let amountStr = m[1] || m[2];
    let curRaw = m[2] || m[1] || "USD";
    if (m[0].includes("$")) {
      amountStr = m[1];
      curRaw = m[2] || "USD";
    }
    if (m[0].includes("฿") || /baht/i.test(m[0])) curRaw = "THB";
    if (m[0].includes("€") || /euro/i.test(m[0])) curRaw = "EUR";
    if (m[0].includes("£")) curRaw = "GBP";
    if (/reais?/i.test(m[0])) curRaw = "BRL";

    const amount = parseFloat(String(amountStr).replace(/,/g, ""));
    if (Number.isNaN(amount)) continue;

    const map: Record<string, string> = {
      usd: "USD",
      dollar: "USD",
      dollars: "USD",
      eur: "EUR",
      euro: "EUR",
      euros: "EUR",
      gbp: "GBP",
      thb: "THB",
      baht: "THB",
      cop: "COP",
      brl: "BRL",
      reais: "BRL",
      real: "BRL",
      mxn: "MXN",
    };
    const currency = map[curRaw.toLowerCase()] || curRaw.toUpperCase().slice(0, 3);
    return { amount, currency };
  }
  return null;
}

export type LocalAskIntent =
  | "afford"
  | "expense"
  | "budget"
  | "analyze"
  | "protect"
  | "goal"
  | "runway"
  | "convert"
  | "recommend"
  | "why"
  | "alternative"
  | "unknown";

export function detectLocalAskIntent(text: string): {
  intent: LocalAskIntent;
  tools: ToolName[];
} {
  const lower = text.toLowerCase();
  if (
    /afford|can i buy|puedo permit|me puedo gast|posso pagar|what if i (spend|buy|book)/i.test(
      lower
    )
  ) {
    return { intent: "afford", tools: ["simulatePurchase", "getDailyBudget"] };
  }
  if (
    /better option|otra opci[oó]n|opci[oó]n m[aá]s barata|find me a better|alternativa|outra op[cç][aã]o|op[cç][aã]o melhor/i.test(
      lower
    )
  ) {
    return { intent: "alternative", tools: ["findBetterOption"] };
  }
  if (
    /why this|why that|\bwhy\??$|por qu[eé]( esto| esta| eso)?|\bpor qu[eé]\b|porque (esto|essa)|por que (isso|esta)|explica(r)? (esto|isso|this)/i.test(
      lower
    )
  ) {
    return { intent: "why", tools: ["explainRecommendation"] };
  }
  if (
    /tonight|esta noche|hoje\s+(à|a)\s+noite|esta noite|go out|salir|quero sair|recommend|recomiend|sugier|qu[eé] hago|o que fazer/i.test(
      lower
    )
  ) {
    return { intent: "recommend", tools: ["recommendExperience"] };
  }
  if (
    /spent|gaste|gastei|register|expense|lunch|dinner|taxi|coffee|bought/i.test(lower)
  ) {
    return { intent: "expense", tools: ["createTransaction"] };
  }
  if (/how much can i spend|cu[aá]nto puedo|quanto posso|daily|weekly|budget/i.test(lower)) {
    return { intent: "budget", tools: ["getDailyBudget", "getWeeklyBudget"] };
  }
  if (/analy[sz]|spending|gastos|cómo voy|como estou/i.test(lower)) {
    return { intent: "analyze", tools: ["getSpendingAnalysis", "getMoneyRunway"] };
  }
  if (/protect|proteger|emergency|flight|locked/i.test(lower)) {
    return { intent: "protect", tools: ["getProtectedMoney", "protectMoney"] };
  }
  if (/save|goal|meta|objetivo|bali/i.test(lower)) {
    return { intent: "goal", tools: ["createGoal"] };
  }
  if (/runway|last|hasta cu[aá]ndo|quanto tempo|run out/i.test(lower)) {
    return { intent: "runway", tools: ["getMoneyRunway"] };
  }
  if (/convert|exchange|cambio|quanto [eé]/i.test(lower)) {
    return { intent: "convert", tools: ["convertCurrency"] };
  }
  return { intent: "unknown", tools: [] };
}

function detectIntent(text: string) {
  return detectLocalAskIntent(text);
}

function extractConcept(text: string): string {
  const lower = text.toLowerCase();
  if (/lunch|almuerzo|almo[cç]o/.test(lower)) return "Lunch";
  if (/dinner|cena|jantar/.test(lower)) return "Dinner";
  if (/taxi|grab|bolt/.test(lower)) return "Taxi";
  if (/coffee|caf[eé]/.test(lower)) return "Coffee";
  if (/market|mercado/.test(lower)) return "Market";
  if (/tour|paseo/.test(lower)) return "Tour";
  return "Expense";
}

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/lunch|dinner|coffee|food|almuerzo|cena|caf|almo|comida/.test(lower)) return "food";
  if (/taxi|bus|transport|grab|uber/.test(lower)) return "transport";
  if (/tour|fun|party|bar/.test(lower)) return "fun";
  return "general";
}

function localizeSimulationImpact(
  simulation: PurchaseSimulation,
  locale: Locale,
  base: string
): string {
  if (!simulation.affordable) {
    const shortfall = Math.round(
      (simulation.purchaseAmountBase - simulation.availableBefore) * 100
    ) / 100;
    return t(locale, "navi.sim_impact_unaffordable", {
      shortfall: formatMoney(shortfall, base, { showCode: true }),
    });
  }
  const dailyDrop =
    simulation.dailyBudgetBefore > 0
      ? (simulation.dailyBudgetBefore - simulation.dailyBudgetAfter) /
        simulation.dailyBudgetBefore
      : 0;
  if (dailyDrop > 0.25) {
    return t(locale, "navi.sim_impact_tight", { days: simulation.daysImpacted });
  }
  return t(locale, "navi.sim_impact_ok");
}

function localizeRunwayMessage(runway: MoneyRunwayResult, locale: Locale): string {
  if (runway.status === "on_track" || runway.daysEarly <= 0) {
    const date = new Date(runway.tripEndDate).toLocaleDateString(
      locale === "es" ? "es-ES" : locale === "pt" ? "pt-BR" : "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    );
    return t(locale, "navi.runway_on_track", { date });
  }
  if (runway.status === "careful") {
    return t(locale, "navi.runway_careful", { daysEarly: runway.daysEarly });
  }
  const date = new Date(runway.runwayDate).toLocaleDateString(
    locale === "es" ? "es-ES" : locale === "pt" ? "pt-BR" : "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );
  return t(locale, "navi.runway_at_risk", { daysEarly: runway.daysEarly, date });
}

function spendingStatusLabel(locale: Locale, status: string): string {
  if (status === "careful") return t(locale, "status.careful");
  if (status === "at_risk") return t(locale, "status.at_risk");
  return t(locale, "status.on_track");
}

function craftReply(
  intent: string,
  locale: Locale,
  ctx: AgentContext,
  toolCalls: AgentToolCall[],
  simulation?: PurchaseSimulation,
  pendingTransaction?: unknown,
  parsed?: { amount: number; currency: string } | null
): string {
  const balance = toolCalls.find((t) => t.name === "getCurrentBalance")?.result as
    | { realAvailable?: number }
    | undefined;
  const daily = toolCalls.find((t) => t.name === "getDailyBudget")?.result as
    | { dailySafeSpend?: number }
    | undefined;
  const weekly = toolCalls.find((t) => t.name === "getWeeklyBudget")?.result as
    | { weeklySafeSpend?: number }
    | undefined;
  const runway = toolCalls.find((t) => t.name === "getMoneyRunway")?.result as
    | MoneyRunwayResult
    | undefined;
  const analysis = toolCalls.find((t) => t.name === "getSpendingAnalysis")?.result as
    | { spentTotal?: number; averageDailySpend?: number; status?: string }
    | undefined;

  const base = ctx.trip?.baseCurrency || "USD";

  if (intent === "afford" && simulation) {
    return t(locale, "navi.simulation_body", {
      availableBefore: formatMoney(simulation.availableBefore, base, { showCode: true }),
      dailyBefore: formatMoney(simulation.dailyBudgetBefore, base),
      weeklyBefore: formatMoney(simulation.weeklyBudgetBefore, base),
      availableAfter: formatMoney(simulation.availableAfter, base, { showCode: true }),
      dailyAfter: formatMoney(simulation.dailyBudgetAfter, base),
      weeklyAfter: formatMoney(simulation.weeklyBudgetAfter, base),
      impact: localizeSimulationImpact(simulation, locale, base),
    });
  }

  if (intent === "expense" && pendingTransaction) {
    const tx = pendingTransaction as {
      concept: string;
      amountOriginal: number;
      currencyOriginal: string;
      amountBase: number;
    };
    return t(locale, "navi.expense_found", {
      concept: tx.concept,
      original: formatMoney(tx.amountOriginal, tx.currencyOriginal as never, {
        showCode: true,
      }),
      base: formatMoney(tx.amountBase, base, { showCode: true }),
    });
  }

  if (intent === "budget") {
    return t(locale, "navi.drs_response", {
      daily: formatMoney(daily?.dailySafeSpend ?? 0, base),
      weekly: formatMoney(weekly?.weeklySafeSpend ?? 0, base),
    });
  }

  if (intent === "analyze" || intent === "runway") {
    if (runway) return localizeRunwayMessage(runway, locale);
    return t(locale, "navi.analyze_summary", {
      spent: formatMoney(analysis?.spentTotal ?? 0, base),
      avg: formatMoney(analysis?.averageDailySpend ?? 0, base),
      status: spendingStatusLabel(locale, analysis?.status ?? "on_track"),
    });
  }

  if (intent === "protect") {
    return t(locale, "navi.protect_done");
  }

  if (intent === "goal" && parsed) {
    return t(locale, "navi.goal_created", {
      amount: formatMoney(parsed.amount, parsed.currency as never, { showCode: true }),
    });
  }

  return t(locale, "navi.general_balance", {
    available: formatMoney(balance?.realAvailable ?? 0, base, { showCode: true }),
    daily: formatMoney(daily?.dailySafeSpend ?? 0, base),
  });
}

async function runCulturalAsk(
  userText: string,
  ctx: AgentContext,
  intent: LocalAskIntent,
  tool: ToolName
): Promise<NaviResponse> {
  const args: Record<string, unknown> = {};
  if (tool === "recommendExperience") {
    args.city = ctx.trip?.city ?? "";
    args.intent = intent === "recommend" ? "tonight" : "general";
  }

  const result = await executeToolAsync(tool, args, ctx);
  const executedTools = [{ name: tool, args, result }];
  const content = formatExperienceToolReply(
    ctx.locale,
    tool as "recommendExperience" | "explainRecommendation" | "findBetterOption",
    result
  );

  const response = buildNaviResponse({
    userText,
    assistantContent: content,
    executedTools,
    locale: ctx.locale,
  });

  if (tool === "recommendExperience" && result.ok) {
    response.experienceRecommendation = result.data as ExperienceRecommendationPayload;
  }

  return response;
}

/** Local heuristic NAVI — fallback when MOCK_AI=true or Azure is unavailable. Not a full LLM. */
export async function runLocalAsk(userText: string, ctx: AgentContext): Promise<NaviResponse> {
  const locale = ctx.locale;
  const { intent, tools } = detectIntent(userText);

  if (intent === "unknown" || tools.length === 0) {
    return buildNaviResponse({
      userText,
      assistantContent: t(locale, "navi.mock_limitation"),
      executedTools: [],
      locale,
    });
  }

  if (isCulturalTool(tools[0])) {
    return runCulturalAsk(userText, ctx, intent, tools[0]);
  }

  const parsed = parseAmountCurrency(userText);
  const executedTools: Array<{
    name: ToolName;
    args: Record<string, unknown>;
    result: ReturnType<typeof executeTool>;
  }> = [];

  let simulation: PurchaseSimulation | undefined;
  let pendingTransaction: unknown;

  for (const tool of tools) {
    const args: Record<string, unknown> = {};
    if (parsed) {
      args.amount = parsed.amount;
      args.currency = parsed.currency;
    }
    if (tool === "createTransaction") {
      args.concept = extractConcept(userText);
      args.category = guessCategory(userText);
      args.source = "text";
    }
    if (tool === "createGoal" && parsed) {
      args.name = "Travel goal";
      args.targetAmount = parsed.amount;
    }
    if (tool === "convertCurrency" && parsed) {
      args.amount = parsed.amount;
      args.from = parsed.currency;
      args.to = ctx.trip?.baseCurrency || "USD";
    }
    if (tool === "protectMoney") {
      const emergency = ctx.pockets.find((p) => p.category === "emergency");
      if (emergency) {
        args.pocketId = emergency.id;
        if (parsed) args.amount = parsed.amount;
      }
    }

    const result = executeTool(tool, args, ctx);
    executedTools.push({ name: tool, args, result });

    if (result.mutation && result.mutation.type !== "none" && result.mutation.payload) {
      if (intent === "expense" && tool === "createTransaction") {
        pendingTransaction = result.mutation.payload;
      }
    }
    if (tool === "simulatePurchase" && result.ok) {
      simulation = result.data as PurchaseSimulation;
    }
  }

  const toolCalls = executedTools.map(({ name, args, result }) =>
    makeToolCall(name, args, result)
  );

  const content = craftReply(
    intent,
    locale,
    ctx,
    toolCalls,
    simulation,
    pendingTransaction,
    parsed
  );

  const response = buildNaviResponse({
    userText,
    assistantContent: content,
    executedTools,
    locale,
  });

  if (simulation) response.simulation = simulation;
  if (pendingTransaction) response.pendingTransaction = pendingTransaction;

  if (intent !== "afford" && intent !== "expense") {
    for (const { name, result } of executedTools) {
      if (
        result.mutation &&
        result.mutation.type !== "none" &&
        result.mutation.payload &&
        name !== "createTransaction"
      ) {
        const exists = response.mutations.some(
          (m) => m.type === result.mutation!.type && m.payload === result.mutation!.payload
        );
        if (!exists) {
          response.mutations.push({
            type: result.mutation.type,
            payload: result.mutation.payload,
          });
        }
      }
    }
  }

  return response;
}
