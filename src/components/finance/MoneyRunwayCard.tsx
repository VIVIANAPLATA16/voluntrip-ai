"use client";

import type { MoneyRunwayResult } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Gauge } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { formatRunwayMessage, spendingStatusLabel } from "@/lib/i18n/labels";

export function MoneyRunwayCard({ runway }: { runway: MoneyRunwayResult }) {
  const locale = useAppStore((s) => s.locale);
  const variant =
    runway.status === "on_track"
      ? "success"
      : runway.status === "careful"
        ? "warning"
        : "danger";

  return (
    <Card elevated className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-ink-muted">
          <Gauge className="h-4 w-4 text-accent" aria-hidden />
          <p className="text-xs uppercase tracking-[0.18em]">{t(locale, "home.money_runway")}</p>
        </div>
        <Badge variant={variant}>{spendingStatusLabel(locale, runway.status)}</Badge>
      </div>
      <p className="text-sm text-ink leading-relaxed">{formatRunwayMessage(locale, runway)}</p>
      {runway.daysEarly > 0 && (
        <div className="h-2 rounded-full bg-bg overflow-hidden flex">
          <div
            className="h-full bg-accent"
            style={{
              width: `${Math.max(10, 100 - runway.daysEarly * 4)}%`,
            }}
          />
          <div className="h-full bg-danger/70 flex-1" />
        </div>
      )}
    </Card>
  );
}
