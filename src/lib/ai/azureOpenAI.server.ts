/**
 * Azure OpenAI — SERVER ONLY.
 * Import exclusively from Route Handlers (e.g. src/app/api/navi/route.ts).
 */

import type { AgentMessage } from "@/types";
import type { ExperienceRecommendationPayload, NaviResponse } from "@/lib/agent/types";
import { attachAffordSimulation } from "@/lib/agent/affordSimulation";
import { runLocalAsk } from "@/lib/agent/localAsk";
import { NAVI_INSIGHT_PROMPT, NAVI_SYSTEM_PROMPT } from "@/lib/agent/prompts";
import {
  buildNaviResponse,
  tripContextSummary,
  type ExecutedTool,
} from "@/lib/agent/responseBuilder";
import type { AgentContext, ToolName } from "@/lib/agent/tools";
import { getOpenAIToolDefinitions } from "@/lib/agent/tools";
import { executeToolAsync } from "@/lib/agent/experienceTools";
import { searchQlooPlaces } from "@/lib/qloo/client";
import {
  mockGenerateInsight,
  type GenerateInsightResult,
} from "@/lib/ai/azureOpenAI";
import { localeLanguageName, t, type Locale } from "@/lib/i18n/dictionaries";

const API_VERSION = "2024-06-01";
const MAX_TOOL_ITERATIONS = 5;

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export function getAzureConfig(): AzureOpenAIConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    apiKey,
    deployment,
  };
}

export function isServerMockMode(): boolean {
  if (process.env.MOCK_AI !== "false") return true;
  if (process.env.NODE_ENV === "development" && !getAzureConfig()) return true;
  return false;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface AzureChatResponse {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

function buildChatMessages(
  history: AgentMessage[],
  ctx: AgentContext
): OpenAIChatMessage[] {
  const language = localeLanguageName(ctx.locale);
  const messages: OpenAIChatMessage[] = [
    {
      role: "system",
      content:
        NAVI_SYSTEM_PROMPT +
        tripContextSummary(ctx) +
        `\n\nResponde SIEMPRE en ${language}, sin importar el idioma del mensaje del usuario.`,
    },
  ];

  for (const msg of history.slice(-12)) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return messages;
}

async function fetchAzureChat(
  config: AzureOpenAIConfig,
  body: Record<string, unknown>
): Promise<AzureChatResponse> {
  const url = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${API_VERSION}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as AzureChatResponse;

  if (!res.ok) {
    const msg = data.error?.message || res.statusText || "Azure OpenAI request failed";
    throw new Error(msg);
  }

  return data;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isToolName(name: string): name is ToolName {
  return getOpenAIToolDefinitions().some((t) => t.function.name === name);
}

/**
 * Call Azure OpenAI with function calling, executing finance tools server-side.
 */
export async function callAzureOpenAI(params: {
  userText: string;
  messages: AgentMessage[];
  tripContext: AgentContext;
}): Promise<NaviResponse> {
  const config = getAzureConfig();
  let tripContext: AgentContext = {
    ...params.tripContext,
    searchPlaces: params.tripContext.searchPlaces ?? searchQlooPlaces,
  };
  const locale = tripContext.locale;

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return runLocalAsk(params.userText, tripContext);
    }
    throw new Error(
      "Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT."
    );
  }

  const chatMessages = buildChatMessages(params.messages, tripContext);
  const tools = getOpenAIToolDefinitions();
  const executedTools: ExecutedTool[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const data = await fetchAzureChat(config, {
      messages: chatMessages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
    });

    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("Empty response from Azure OpenAI");
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      chatMessages.push({
        role: "assistant",
        content: message.content,
        tool_calls: message.tool_calls,
      });

      for (const toolCall of message.tool_calls) {
        const rawName = toolCall.function.name;
        const args = parseToolArgs(toolCall.function.arguments);

        if (!isToolName(rawName)) {
          chatMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${rawName}` }),
          });
          continue;
        }

        const result = await executeToolAsync(rawName, args, tripContext);
        executedTools.push({ name: rawName, args, result });
        if (rawName === "recommendExperience" && result.ok) {
          tripContext = {
            ...tripContext,
            lastRecommendation: result.data as ExperienceRecommendationPayload,
          };
        }

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(
            result.ok
              ? { data: result.data, mutation: result.mutation?.type ?? "none" }
              : { error: result.error }
          ),
        });
      }

      continue;
    }

    const content =
      message.content?.trim() || t(locale, "navi.azure_fallback");

    const response = buildNaviResponse({
      userText: params.userText,
      assistantContent: content,
      executedTools,
      locale,
    });
    const rec = executedTools.find(
      (tool) => tool.name === "recommendExperience" && tool.result.ok
    );
    if (rec) {
      response.experienceRecommendation = rec.result.data as ExperienceRecommendationPayload;
    }
    return attachAffordSimulation(params.userText, tripContext, response);
  }

  throw new Error("Azure OpenAI exceeded maximum tool-calling iterations");
}

/**
 * Proactive Home insight via Azure (or mock). Never throws — always returns a usable insight.
 */
export async function generateInsight(
  status: string,
  dailySpend: number,
  safeDaily: number,
  locale: Locale = "en"
): Promise<GenerateInsightResult> {
  if (isServerMockMode()) {
    return mockGenerateInsight(status, dailySpend, safeDaily);
  }

  const config = getAzureConfig();
  if (!config) {
    return mockGenerateInsight(status, dailySpend, safeDaily);
  }

  const language = localeLanguageName(locale);

  try {
    const data = await fetchAzureChat(config, {
      messages: [
        {
          role: "system",
          content: `${NAVI_INSIGHT_PROMPT}

Respond ONLY with valid JSON (no markdown):
{"title":"short title","message":"1-2 sentences","type":"warning"|"success"|"info"|"tip"}

Respond in ${language}. Use the spending numbers provided; do not invent other balances.`,
        },
        {
          role: "user",
          content: `Spending status: ${status}. Average daily spend: ${dailySpend}. Safe daily budget (DRS): ${safeDaily}.`,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return mockGenerateInsight(status, dailySpend, safeDaily);
    }

    const parsed = JSON.parse(raw) as Partial<GenerateInsightResult>;
    const type =
      parsed.type === "warning" ||
      parsed.type === "success" ||
      parsed.type === "info" ||
      parsed.type === "tip"
        ? parsed.type
        : "info";

    if (!parsed.title || !parsed.message) {
      return mockGenerateInsight(status, dailySpend, safeDaily);
    }

    return {
      title: String(parsed.title).slice(0, 80),
      message: String(parsed.message).slice(0, 400),
      type,
    };
  } catch {
    return mockGenerateInsight(status, dailySpend, safeDaily);
  }
}
