import type {
  CurrencyCode,
  Pocket,
  PurchaseSimulation,
  Transaction,
  Trip,
} from "@/types";
import { buildBudgetSnapshot } from "./budget";
import { convertCurrency } from "./currency";

export function simulatePurchase(
  trip: Trip,
  transactions: Transaction[],
  pockets: Pocket[],
  amount: number,
  currency: CurrencyCode,
  now: Date = new Date()
): PurchaseSimulation {
  const before = buildBudgetSnapshot(trip, transactions, pockets, now);
  const purchaseAmountBase = convertCurrency(amount, currency, trip.baseCurrency);

  const availableAfter = Math.max(0, before.realAvailable - purchaseAmountBase);
  const dailyBudgetAfter =
    before.daysRemaining > 0 ? availableAfter / before.daysRemaining : 0;
  const weeklyBudgetAfter =
    before.weeksRemaining > 0 ? availableAfter / before.weeksRemaining : 0;

  const affordable = purchaseAmountBase <= before.realAvailable;
  const dailyDrop = before.dailySafeSpend - dailyBudgetAfter;
  const daysImpacted = Math.min(
    before.daysRemaining,
    Math.ceil(purchaseAmountBase / Math.max(before.dailySafeSpend, 0.01))
  );

  let impactMessage: string;
  if (!affordable) {
    impactMessage = `You cannot afford this without touching protected money. You need ${Math.round((purchaseAmountBase - before.realAvailable) * 100) / 100} more in available funds.`;
  } else if (dailyDrop / Math.max(before.dailySafeSpend, 0.01) > 0.25) {
    impactMessage = `You can afford it, but you'll need to reduce your daily spending for the next ${daysImpacted} days.`;
  } else {
    impactMessage = `You can comfortably afford this. Your daily budget only drops slightly.`;
  }

  return {
    purchaseAmount: amount,
    purchaseCurrency: currency,
    purchaseAmountBase: Math.round(purchaseAmountBase * 100) / 100,
    availableBefore: before.realAvailable,
    availableAfter: Math.round(availableAfter * 100) / 100,
    dailyBudgetBefore: before.dailySafeSpend,
    dailyBudgetAfter: Math.round(dailyBudgetAfter * 100) / 100,
    weeklyBudgetBefore: before.weeklySafeSpend,
    weeklyBudgetAfter: Math.round(weeklyBudgetAfter * 100) / 100,
    affordable,
    impactMessage,
    daysImpacted,
  };
}

export interface WhatIfScenario {
  type: "spend" | "extend" | "lose" | "save" | "flight";
  amount?: number;
  currency?: CurrencyCode;
  extraDays?: number;
}

export function simulateWhatIf(
  trip: Trip,
  transactions: Transaction[],
  pockets: Pocket[],
  scenario: WhatIfScenario,
  now: Date = new Date()
) {
  const before = buildBudgetSnapshot(trip, transactions, pockets, now);

  if (scenario.type === "extend" && scenario.extraDays) {
    const newDays = before.daysRemaining + scenario.extraDays;
    const newDaily = before.realAvailable / newDays;
    return {
      before,
      after: {
        ...before,
        daysRemaining: newDays,
        dailySafeSpend: Math.round(newDaily * 100) / 100,
        weeklySafeSpend: Math.round((before.realAvailable / (newDays / 7)) * 100) / 100,
      },
      message: `Extending by ${scenario.extraDays} days lowers your daily safe spend to $${newDaily.toFixed(2)}.`,
    };
  }

  const amount = scenario.amount ?? 0;
  const currency = scenario.currency ?? trip.baseCurrency;
  const baseAmt = convertCurrency(amount, currency, trip.baseCurrency);

  let delta = 0;
  if (scenario.type === "spend" || scenario.type === "lose" || scenario.type === "flight") {
    delta = -baseAmt;
  } else if (scenario.type === "save") {
    delta = 0; // save moves to protected — available drops
    delta = -baseAmt;
  }

  const availableAfter = Math.max(0, before.realAvailable + delta);
  const dailyAfter = availableAfter / before.daysRemaining;

  return {
    before,
    after: {
      ...before,
      realAvailable: Math.round(availableAfter * 100) / 100,
      dailySafeSpend: Math.round(dailyAfter * 100) / 100,
      weeklySafeSpend: Math.round((availableAfter / before.weeksRemaining) * 100) / 100,
    },
    message: `After this change, you'd have $${availableAfter.toFixed(2)} available ($${dailyAfter.toFixed(2)}/day).`,
  };
}
