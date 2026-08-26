import type { BudgetSnapshot, MoneyRunwayResult, SpendingStatus, Trip } from "@/types";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Money runway: how long current money lasts at current spending pace.
 */
export function calculateMoneyRunway(
  trip: Trip,
  snapshot: BudgetSnapshot,
  now: Date = new Date()
): MoneyRunwayResult {
  const tripEnd = new Date(trip.endDate);
  const daysRemaining = snapshot.daysRemaining;
  const avg = snapshot.averageDailySpend;
  const available = snapshot.realAvailable;

  let runwayDays: number;
  if (avg <= 0.01) {
    runwayDays = daysRemaining;
  } else {
    runwayDays = Math.floor(available / avg);
  }

  const runwayDate = addDays(now, runwayDays);
  const daysEarly = Math.max(0, daysRemaining - runwayDays);
  let status: SpendingStatus = snapshot.status;

  let message: string;
  if (avg <= 0.01 || runwayDays >= daysRemaining) {
    status = "on_track";
    message = `You are on track. Your current money can last until ${formatDate(tripEnd)}.`;
  } else if (daysEarly <= 3) {
    status = "careful";
    message = `Your money may run out ${daysEarly} day${daysEarly === 1 ? "" : "s"} early.`;
  } else {
    status = "at_risk";
    message = `Your money may run out ${daysEarly} days early — around ${formatDate(runwayDate)}.`;
  }

  return {
    runwayDate: runwayDate.toISOString().slice(0, 10),
    daysRemaining: runwayDays,
    tripEndDate: trip.endDate,
    daysEarly,
    status,
    message,
  };
}
