import type { AgentMessage } from "@/types";

const MAX_MEMORY = 40;

export class AgentMemory {
  private messages: AgentMessage[] = [];

  load(messages: AgentMessage[]) {
    this.messages = messages.slice(-MAX_MEMORY);
  }

  add(message: AgentMessage) {
    this.messages.push(message);
    if (this.messages.length > MAX_MEMORY) {
      this.messages = this.messages.slice(-MAX_MEMORY);
    }
  }

  getRecent(n = 10): AgentMessage[] {
    return this.messages.slice(-n);
  }

  all(): AgentMessage[] {
    return [...this.messages];
  }

  clear() {
    this.messages = [];
  }
}
