import type { AgentMessage, PurchaseSimulation } from "@/types";

export interface NaviResponse {
  message: AgentMessage;
  simulation?: PurchaseSimulation;
  pendingTransaction?: unknown;
  mutations: Array<{ type: string; payload: unknown }>;
}
