import type { Trip } from "@/types";
import { remainingTripDays } from "@/lib/finance/budget";

export const DEMO_REMAINING_DAYS: Record<string, number> = {
  "demo-trip-medellin": 12,
  "demo-trip-singapore": 9,
};

/** Local noon, so canned demos stay on-target across midnight and DST gaps. */
export function demoBudgetNow(now: Date = new Date()): Date {
  const midday = new Date(now);
  midday.setHours(12, 0, 0, 0);
  return midday;
}

function parseNow(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

/** Dashboard clock: canned Medellín/Singapore demos use local noon; real trips use `now`. */
export function budgetNowForTrip(trip: { id: string } | null | undefined, now: Date = new Date()): Date {
  if (trip && DEMO_REMAINING_DAYS[trip.id]) return demoBudgetNow(now);
  return now;
}

/**
 * Seed from the client ISO when present, then apply the demo local-noon clock.
 * Using the ISO as-is on a UTC server keeps the Bogotá endDate and yields +1 day.
 */
export function resolveBudgetNow(
  trip: { id: string } | null | undefined,
  provided?: unknown
): Date {
  return budgetNowForTrip(trip, parseNow(provided) ?? new Date());
}

/** Recompute canned demo start/end so remainingTripDays hits the target in this process TZ. */
export function alignDemoTripForBudget<T extends Trip>(trip: T, now: Date = new Date()): T {
  return refreshDemoTripDates(trip, now) as T;
}

/** Clock + dates the dashboard and NAVI tools must share for canned demos. */
export function prepareDemoBudgetContext<T extends Trip>(
  trip: T,
  provided?: unknown
): { trip: T; now: Date } {
  const now = resolveBudgetNow(trip, provided);
  return { trip: alignDemoTripForBudget(trip, now), now };
}

export function isoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function searchEndDate(days: number, now: Date): string | null {
  for (let offset = 0; offset <= days + 10; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    const endDate = isoDateLocal(candidate);
    if (remainingTripDays({ endDate } as Trip, now) === days) return endDate;
  }
  return null;
}

/** Calendar endDate that makes remainingTripDays(trip, now) === days. Does not change finance math. */
export function endDateWithRemainingDays(days: number, now: Date = new Date()): string {
  const exact = searchEndDate(days, now);
  if (exact) return exact;
  const midday = new Date(now);
  midday.setHours(12, 0, 0, 0);
  const fromMidday = searchEndDate(days, midday);
  if (fromMidday) return fromMidday;
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + days);
  return isoDateLocal(fallback);
}

/** Keep canned demo trips on their target remaining-day count as the calendar moves. */
export function refreshDemoTripDates(trip: Trip, now: Date = new Date()): Trip {
  const days = DEMO_REMAINING_DAYS[trip.id];
  if (!days) return trip;
  const startDate = isoDateLocal(now);
  const endDate = endDateWithRemainingDays(days, demoBudgetNow(now));
  if (trip.startDate === startDate && trip.endDate === endDate) return trip;
  return { ...trip, startDate, endDate, updatedAt: now.toISOString() };
}
