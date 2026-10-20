"use client";

import { Progress } from "./Progress";
import { daysBetween, remainingTripDays } from "@/lib/finance/budget";
import type { Trip } from "@/types";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";

export function TripProgress({ trip }: { trip: Trip }) {
  const locale = useAppStore((s) => s.locale);
  const now = new Date();
  const total = Math.max(1, daysBetween(trip.startDate, trip.endDate));
  const elapsed = Math.min(total, daysBetween(trip.startDate, now));
  const remaining = remainingTripDays(trip, now);
  const pct = (elapsed / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-faint">
            {t(locale, "trip.countdown")}
          </p>
          <p className="font-display text-2xl font-semibold text-ink mt-1">
            {remaining}{" "}
            <span className="text-base text-ink-muted font-body">
              {t(locale, "home.days_left")}
            </span>
          </p>
        </div>
      </div>
      <Progress value={pct} label={t(locale, "trip.progress")} />
      <div className="flex justify-between text-xs text-ink-faint">
        <span>{t(locale, "trip.start_label")}</span>
        <span>{t(locale, "trip.end_label")}</span>
      </div>
    </div>
  );
}
