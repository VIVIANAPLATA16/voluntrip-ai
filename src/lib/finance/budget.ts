import type { BudgetSnapshot, Pocket, SpendingStatus, Transaction, Trip } from "@/types";
import { sumProtectedPockets, sumTransactionsBase } from "./currency";

export function daysBetween(start: string | Date, end: string | Date): number {
  const a = typeof start === "string" ? new Date(start) : start;
  const b = typeof end === "string" ? new Date(end) : end;
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function remainingTripDays(trip: Trip, now: Date = new Date()): number {
  const end = new Date(trip.endDate);
  end.setHours(23, 59, 59, 999);
  const days = daysBetween(now, end);
  return Math.max(1, days); // at least 1 day to avoid division by zero
}

export function remainingWeeks(days: number): number {
  return Math.max(days / 7, 1 / 7);
}

/**
 * DRS = (Total balance - Protected pockets) / Remaining weeks
 */
export function calculateDRS(realAvailable: number, weeksRemaining: number): number {
  if (weeksRemaining <= 0) return 0;
  return realAvailable / weeksRemaining;
}

export function calculateDailyBudget(realAvailable: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return realAvailable / daysRemaining;
}

export function getCurrentBalance(trip: Trip, transactions: Transaction[]): number {
  const spent = sumTransactionsBase(transactions.filter((t) => t.tripId === trip.id));
  return trip.initialBudget - spent;
}

export function getProtectedMoney(pockets: Pocket[], tripId: string): number {
  return sumProtectedPockets(pockets.filter((p) => p.tripId === tripId));
}

export function getRealAvailable(
  trip: Trip,
  transactions: Transaction[],
  pockets: Pocket[]
): number {
  const balance = getCurrentBalance(trip, transactions);
  const protectedAmt = getProtectedMoney(pockets, trip.id);
  return Math.max(0, balance - protectedAmt);
}

export function detectSpendingStatus(
  realAvailable: number,
  averageDailySpend: number,
  daysRemaining: number,
  dailySafeSpend: number
): SpendingStatus {
  if (dailySafeSpend <= 0) return "at_risk";
  if (averageDailySpend <= 0) return "on_track";

  const projectedNeed = averageDailySpend * daysRemaining;
  const ratio = projectedNeed / realAvailable;

  if (ratio > 1.15) return "at_risk";
  if (ratio > 0.95) return "careful";
  return "on_track";
}

export function buildBudgetSnapshot(
  trip: Trip,
  transactions: Transaction[],
  pockets: Pocket[],
  now: Date = new Date()
): BudgetSnapshot {
  const tripTx = transactions.filter((t) => t.tripId === trip.id);
  const totalBalance = getCurrentBalance(trip, tripTx);
  const protectedMoney = getProtectedMoney(pockets, trip.id);
  const realAvailable = Math.max(0, totalBalance - protectedMoney);
  const daysRemaining = remainingTripDays(trip, now);
  const weeksRemaining = remainingWeeks(daysRemaining);
  const dailySafeSpend = calculateDailyBudget(realAvailable, daysRemaining);
  const weeklySafeSpend = calculateDRS(realAvailable, weeksRemaining);
  const spentTotal = sumTransactionsBase(tripTx);

  const start = new Date(trip.startDate);
  const elapsed = Math.max(1, daysBetween(start, now));
  const averageDailySpend = spentTotal / elapsed;

  const status = detectSpendingStatus(
    realAvailable,
    averageDailySpend,
    daysRemaining,
    dailySafeSpend
  );

  return {
    totalBalance,
    protectedMoney,
    realAvailable,
    daysRemaining,
    weeksRemaining,
    dailySafeSpend: Math.round(dailySafeSpend * 100) / 100,
    weeklySafeSpend: Math.round(weeklySafeSpend * 100) / 100,
    status,
    spentTotal: Math.round(spentTotal * 100) / 100,
    averageDailySpend: Math.round(averageDailySpend * 100) / 100,
  };
}
