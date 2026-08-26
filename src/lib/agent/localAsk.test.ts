import { describe, expect, it } from "vitest";
import type { Trip } from "@/types";
import { runLocalAsk } from "./localAsk";

const trip: Trip = {
  id: "t1",
  destination: "Chiang Mai, Thailand",
  city: "Chiang Mai",
  country: "Thailand",
  countryCode: "TH",
  flag: "🇹🇭",
  baseCurrency: "USD",
  localCurrency: "THB",
  startDate: "2026-08-01",
  endDate: "2026-09-15",
  initialBudget: 1500,
  includedBenefits: ["accommodation"],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("runLocalAsk locale", () => {
  it("responds in Spanish when profile locale is es, even if user writes in English", () => {
    const result = runLocalAsk("How much can I spend today?", {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "es",
    });

    expect(result.message.locale).toBe("es");
    expect(result.message.content).toMatch(/Puedes gastar con seguridad/i);
    expect(result.message.content).not.toMatch(/You can safely spend/i);
  });

  it("responds in Portuguese when profile locale is pt", () => {
    const result = runLocalAsk("How much can I spend today?", {
      trip,
      pockets: [],
      transactions: [],
      goals: [],
      locale: "pt",
    });

    expect(result.message.content).toMatch(/Você pode gastar com segurança/i);
  });

  it("returns mock limitation message for unmatched general questions", () => {
    const result = runLocalAsk(
      "What documents do I need to volunteer in Costa Rica?",
      {
        trip,
        pockets: [],
        transactions: [],
        goals: [],
        locale: "en",
      }
    );

    expect(result.message.content).toMatch(/needs NAVI with real AI/i);
    expect(result.message.content).not.toMatch(/You can safely spend/i);
    expect(result.mutations).toEqual([]);
  });
});
