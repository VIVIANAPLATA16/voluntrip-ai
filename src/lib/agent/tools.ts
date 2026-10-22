import type {
  AgentToolCall,
  BudgetSnapshot,
  CulturalProfile,
  CurrencyCode,
  Goal,
  LocaleCode,
  MoneyRunwayResult,
  Pocket,
  PurchaseSimulation,
  Transaction,
  Trip,
} from "@/types";
import type { QlooPlaceQuery, QlooResult } from "@/lib/qloo/types";
import type { ExperienceRecommendationPayload } from "./types";
import {
  buildBudgetSnapshot,
  calculateMoneyRunway,
  convertCurrency,
  createTransaction,
  getProtectedMoney,
  simulatePurchase,
} from "@/lib/finance";
import { createId } from "@/lib/id";
import { alignDemoTripForBudget, resolveBudgetNow } from "@/lib/demo/remainingDays";

export interface AgentContext {
  trip: Trip | null;
  pockets: Pocket[];
  transactions: Transaction[];
  goals: Goal[];
  locale: LocaleCode;
  /** Dashboard clock. ISO string after JSON (Azure /api/navi). */
  now?: Date | string;
  culturalProfile?: CulturalProfile | null;
  lastRecommendation?: ExperienceRecommendationPayload | null;
  /** Server injects the Qloo client; the browser uses POST /api/qloo instead. */
  searchPlaces?: (query: QlooPlaceQuery) => Promise<QlooResult>;
}

export type ToolName =
  | "getTripContext"
  | "getCurrentBalance"
  | "getProtectedMoney"
  | "getWeeklyBudget"
  | "getDailyBudget"
  | "getMoneyRunway"
  | "getSpendingAnalysis"
  | "createTransaction"
  | "updateTransaction"
  | "deleteTransaction"
  | "createPocket"
  | "protectMoney"
  | "createGoal"
  | "simulatePurchase"
  | "convertCurrency"
  | "generateFinancialInsight"
  | "recommendExperience"
  | "explainRecommendation"
  | "findBetterOption"
  | "planStretch";

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  mutation?: {
    type: "transaction" | "pocket" | "goal" | "none";
    payload?: unknown;
  };
}

function requireTrip(ctx: AgentContext): Trip {
  if (!ctx.trip) throw new Error("No active trip");
  return ctx.trip;
}

function agentNow(ctx: AgentContext): Date {
  return resolveBudgetNow(ctx.trip, ctx.now);
}

function budgetTrip(ctx: AgentContext): { trip: Trip; now: Date } {
  const trip = requireTrip(ctx);
  const now = agentNow(ctx);
  return { trip: alignDemoTripForBudget(trip, now), now };
}

function snapshot(ctx: AgentContext): BudgetSnapshot {
  const { trip, now } = budgetTrip(ctx);
  return buildBudgetSnapshot(trip, ctx.transactions, ctx.pockets, now);
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const emptyParams = { type: "object" as const, properties: {} };

export const toolDefinitions: ToolDefinition[] = [
  { name: "getTripContext", description: "Get current trip details", parameters: emptyParams },
  {
    name: "getCurrentBalance",
    description: "Get current total balance and real available money",
    parameters: emptyParams,
  },
  {
    name: "getProtectedMoney",
    description: "Get protected pocket totals that cannot be spent",
    parameters: emptyParams,
  },
  {
    name: "getWeeklyBudget",
    description: "Get DRS weekly safe spend amount",
    parameters: emptyParams,
  },
  {
    name: "getDailyBudget",
    description: "Get daily safe spend amount",
    parameters: emptyParams,
  },
  {
    name: "getMoneyRunway",
    description: "Estimate when money may run out vs trip end date",
    parameters: emptyParams,
  },
  {
    name: "getSpendingAnalysis",
    description: "Analyze spending patterns and totals by category",
    parameters: emptyParams,
  },
  {
    name: "createTransaction",
    description: "Create a new expense transaction (requires user confirmation before saving)",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Expense amount in original currency" },
        currency: { type: "string", description: "ISO 4217 currency code" },
        concept: { type: "string", description: "Short label e.g. Lunch, Taxi" },
        category: {
          type: "string",
          enum: ["food", "transport", "fun", "general"],
          description: "Expense category",
        },
        source: {
          type: "string",
          enum: ["text", "voice", "receipt", "manual"],
          description: "How the expense was captured",
        },
        pocketId: { type: "string", description: "Optional pocket id" },
      },
      required: ["amount", "currency", "concept"],
    },
  },
  {
    name: "updateTransaction",
    description: "Update an existing expense",
    parameters: {
      type: "object",
      properties: {
        transactionId: { type: "string" },
        amount: { type: "number" },
        concept: { type: "string" },
        category: { type: "string" },
      },
      required: ["transactionId"],
    },
  },
  {
    name: "deleteTransaction",
    description: "Delete an expense",
    parameters: {
      type: "object",
      properties: {
        transactionId: { type: "string" },
      },
      required: ["transactionId"],
    },
  },
  {
    name: "createPocket",
    description: "Create a virtual money pocket",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number" },
        protected: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "protectMoney",
    description: "Protect money in a pocket so it is not spendable",
    parameters: {
      type: "object",
      properties: {
        pocketId: { type: "string" },
        amount: { type: "number" },
      },
      required: ["pocketId"],
    },
  },
  {
    name: "createGoal",
    description: "Create a travel savings goal",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        targetAmount: { type: "number" },
        currentAmount: { type: "number" },
        protected: { type: "boolean" },
      },
      required: ["name", "targetAmount"],
    },
  },
  {
    name: "simulatePurchase",
    description: "Simulate a purchase impact without saving — always use before confirming spend",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Purchase amount" },
        currency: { type: "string", description: "ISO 4217 currency code" },
      },
      required: ["amount", "currency"],
    },
  },
  {
    name: "convertCurrency",
    description: "Convert an amount between currencies",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        from: { type: "string", description: "Source currency code" },
        to: { type: "string", description: "Target currency code" },
      },
      required: ["amount", "from", "to"],
    },
  },
  {
    name: "generateFinancialInsight",
    description: "Generate a proactive financial insight for the traveler",
    parameters: emptyParams,
  },
  {
    name: "recommendExperience",
    description:
      "Recommend a going-out experience using Cultural DNA, budget safety, and trip context. Never records a purchase.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City to search (defaults to the active trip city)" },
        intent: {
          type: "string",
          enum: ["tonight", "general"],
          description: "tonight boosts nightlife/evening context fit",
        },
      },
    },
  },
  {
    name: "explainRecommendation",
    description:
      "Explain the last experience recommendation, splitting From Qloo vs From Voluntrip evidence.",
    parameters: emptyParams,
  },
  {
    name: "findBetterOption",
    description:
      "Return a cheaper alternative with culturalFit >= 60, or say none exists. Never records a purchase.",
    parameters: emptyParams,
  },
  {
    name: "planStretch",
    description:
      "Build a multi-night stretch plan from live Qloo places for the trip city. Same Cultural DNA for Best match and Stretched. Never records a purchase. Do not invent totals — copy numbers from the tool result.",
    parameters: {
      type: "object",
      properties: {
        nights: {
          type: "number",
          enum: [2, 3, 5],
          description: "Nights to plan. Defaults to 3. Never more than remaining trip days.",
        },
      },
    },
  },
];

/** OpenAI / Azure function-calling tool definitions */
export function getOpenAIToolDefinitions() {
  return toolDefinitions.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function executeTool(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: AgentContext
): ToolResult {
  try {
    switch (name) {
      case "getTripContext": {
        const trip = requireTrip(ctx);
        return { ok: true, data: trip };
      }
      case "getCurrentBalance": {
        const s = snapshot(ctx);
        return { ok: true, data: { totalBalance: s.totalBalance, realAvailable: s.realAvailable } };
      }
      case "getProtectedMoney": {
        const trip = requireTrip(ctx);
        return {
          ok: true,
          data: { protected: getProtectedMoney(ctx.pockets, trip.id) },
        };
      }
      case "getWeeklyBudget": {
        const s = snapshot(ctx);
        return { ok: true, data: { weeklySafeSpend: s.weeklySafeSpend, weeksRemaining: s.weeksRemaining } };
      }
      case "getDailyBudget": {
        const s = snapshot(ctx);
        return { ok: true, data: { dailySafeSpend: s.dailySafeSpend, daysRemaining: s.daysRemaining } };
      }
      case "getMoneyRunway": {
        const { trip, now } = budgetTrip(ctx);
        const s = snapshot(ctx);
        const runway: MoneyRunwayResult = calculateMoneyRunway(trip, s, now);
        return { ok: true, data: runway };
      }
      case "getSpendingAnalysis": {
        const s = snapshot(ctx);
        const byCategory = ctx.transactions.reduce<Record<string, number>>((acc, t) => {
          acc[t.category] = (acc[t.category] ?? 0) + t.amountBase;
          return acc;
        }, {});
        return {
          ok: true,
          data: {
            spentTotal: s.spentTotal,
            averageDailySpend: s.averageDailySpend,
            status: s.status,
            byCategory,
          },
        };
      }
      case "simulatePurchase": {
        const { trip, now } = budgetTrip(ctx);
        const amount = Number(args.amount);
        const currency = (args.currency as CurrencyCode) || trip.baseCurrency;
        const sim: PurchaseSimulation = simulatePurchase(
          trip,
          ctx.transactions,
          ctx.pockets,
          amount,
          currency,
          now
        );
        return { ok: true, data: sim, mutation: { type: "none" } };
      }
      case "convertCurrency": {
        const amount = Number(args.amount);
        const from = args.from as CurrencyCode;
        const to = args.to as CurrencyCode;
        return {
          ok: true,
          data: {
            amount,
            from,
            to,
            converted: Math.round(convertCurrency(amount, from, to) * 100) / 100,
          },
        };
      }
      case "createTransaction": {
        const trip = requireTrip(ctx);
        const tx = createTransaction({
          tripId: trip.id,
          amountOriginal: Number(args.amount),
          currencyOriginal: (args.currency as CurrencyCode) || trip.localCurrency,
          currencyBase: trip.baseCurrency,
          concept: String(args.concept || "Expense"),
          category: String(args.category || "general"),
          source: (args.source as "text" | "voice" | "receipt" | "manual") || "text",
          pocketId: args.pocketId as string | undefined,
        });
        return {
          ok: true,
          data: tx,
          mutation: { type: "transaction", payload: tx },
        };
      }
      case "protectMoney": {
        const pocketId = String(args.pocketId || "");
        const pocket = ctx.pockets.find((p) => p.id === pocketId);
        if (!pocket) return { ok: false, error: "Pocket not found" };
        const updated = {
          ...pocket,
          protected: true,
          balance: Number(args.amount ?? pocket.balance),
          updatedAt: new Date().toISOString(),
        };
        return {
          ok: true,
          data: updated,
          mutation: { type: "pocket", payload: updated },
        };
      }
      case "createPocket": {
        const trip = requireTrip(ctx);
        const pocket: Pocket = {
          id: createId(),
          tripId: trip.id,
          name: String(args.name || "Custom"),
          category: "custom",
          balance: Number(args.amount || 0),
          allocated: Number(args.amount || 0),
          protected: Boolean(args.protected),
          icon: "wallet",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          ok: true,
          data: pocket,
          mutation: { type: "pocket", payload: pocket },
        };
      }
      case "createGoal": {
        const trip = requireTrip(ctx);
        const goal: Goal = {
          id: createId(),
          tripId: trip.id,
          name: String(args.name || "Goal"),
          targetAmount: Number(args.targetAmount || 0),
          currentAmount: Number(args.currentAmount || 0),
          currency: trip.baseCurrency,
          protected: Boolean(args.protected),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          ok: true,
          data: goal,
          mutation: { type: "goal", payload: goal },
        };
      }
      case "generateFinancialInsight": {
        const { trip, now } = budgetTrip(ctx);
        const s = snapshot(ctx);
        const runway = calculateMoneyRunway(trip, s, now);
        return {
          ok: true,
          data: {
            status: s.status,
            message: runway.message,
            dailySafeSpend: s.dailySafeSpend,
            weeklySafeSpend: s.weeklySafeSpend,
          },
        };
      }
      case "updateTransaction":
      case "deleteTransaction":
        return {
          ok: true,
          data: { acknowledged: true, args },
          mutation: { type: "none" },
        };
      case "recommendExperience":
      case "explainRecommendation":
      case "findBetterOption":
      case "planStretch":
        return {
          ok: false,
          error: `${name} must be executed asynchronously`,
          mutation: { type: "none" },
        };
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool failed" };
  }
}

export function makeToolCall(
  name: ToolName,
  args: Record<string, unknown>,
  result?: ToolResult
): AgentToolCall {
  return {
    id: createId(),
    name,
    arguments: args,
    result: result?.data,
    status: result ? (result.ok ? "success" : "error") : "pending",
  };
}
