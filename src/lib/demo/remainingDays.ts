import type { Trip } from "@/types";
import { remainingTripDays } from "@/lib/finance/budget";

export function isoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar endDate that makes remainingTripDays(trip, now) === days. Does not change finance math. */
export function endDateWithRemainingDays(days: number, now: Date = new Date()): string {
  for (let offset = Math.max(1, days - 2); offset <= days + 4; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    const endDate = isoDateLocal(candidate);
    if (remainingTripDays({ endDate } as Trip, now) === days) return endDate;
  }
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + days);
  return isoDateLocal(fallback);
}
