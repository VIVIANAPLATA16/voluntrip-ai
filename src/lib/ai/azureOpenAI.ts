/**
 * Client-safe Azure OpenAI helpers.
 * Never put API keys here — real calls go through /api/navi (server-only).
 */

export interface ProcessFinancialInputResult {
  intent: string;
  amount?: number;
  currency?: string;
  concept?: string;
  category?: string;
  language: string;
}

export interface AskNaviResult {
  reply: string;
  toolNames: string[];
}

export interface AnalyzeReceiptResult {
  merchant: string;
  items: Array<{ name: string; price: number }>;
  total: number;
  currency: string;
  date: string;
}

export interface GenerateInsightResult {
  title: string;
  message: string;
  type: "warning" | "success" | "info" | "tip";
}

export interface SimulatePurchaseAIResult {
  summary: string;
}

/** Deterministic mock insight — used when MOCK_AI or Azure unavailable. */
export function mockGenerateInsight(
  status: string,
  dailySpend: number,
  safeDaily: number
): GenerateInsightResult {
  if (status === "at_risk") {
    return {
      title: "Pace check",
      message: `Your current spending pace may make your money run out early. Try staying near ${safeDaily.toFixed(2)}/day.`,
      type: "warning",
    };
  }
  if (dailySpend < safeDaily * 0.85) {
    return {
      title: "Looking good",
      message: "You are doing great. You are below your weekly budget.",
      type: "success",
    };
  }
  return {
    title: "Steady",
    message:
      "You have enough room to plan a small weekend experience if you stay disciplined.",
    type: "info",
  };
}

export async function processFinancialInput(
  text: string
): Promise<ProcessFinancialInputResult> {
  const language = /[áéíóúñ¿¡]/i.test(text)
    ? "es"
    : /[ãõç]/i.test(text)
      ? "pt"
      : "en";
  return {
    intent: "expense",
    language,
    concept: "Expense",
    category: "general",
  };
}

export async function askNavi(prompt: string, context: string): Promise<AskNaviResult> {
  return {
    reply: `NAVI (mock): I understand your request about your trip finances. Context length: ${context.length}. Prompt: ${prompt.slice(0, 80)}…`,
    toolNames: ["getCurrentBalance", "getDailyBudget"],
  };
}

/** Receipt OCR stub — real OCR is server-side via /api/navi/ocr (Azure Vision). */
export async function analyzeReceipt(
  imageBase64: string
): Promise<AnalyzeReceiptResult> {
  void imageBase64;
  return {
    merchant: "Local Market",
    items: [
      { name: "Fruit", price: 80 },
      { name: "Snacks", price: 40 },
    ],
    total: 120,
    currency: "THB",
    date: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Client entry for Home insights. Calls /api/navi (server has Azure credentials).
 * Never throws — falls back to mock on any failure so the UI stays stable.
 */
export async function generateInsight(
  status: string,
  dailySpend: number,
  safeDaily: number,
  locale: string = "en"
): Promise<GenerateInsightResult> {
  try {
    const res = await fetch("/api/navi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "insight",
        status,
        dailySpend,
        safeDaily,
        locale,
      }),
    });
    if (!res.ok) {
      return mockGenerateInsight(status, dailySpend, safeDaily);
    }
    const data = (await res.json()) as GenerateInsightResult & { error?: string };
    if (data.error || !data.title || !data.message) {
      return mockGenerateInsight(status, dailySpend, safeDaily);
    }
    return {
      title: data.title,
      message: data.message,
      type: data.type || "info",
    };
  } catch {
    return mockGenerateInsight(status, dailySpend, safeDaily);
  }
}

export async function simulatePurchase(
  amount: number,
  currency: string
): Promise<SimulatePurchaseAIResult> {
  return {
    summary: `Mock simulation for ${amount} ${currency}. Use the finance engine for exact numbers.`,
  };
}
