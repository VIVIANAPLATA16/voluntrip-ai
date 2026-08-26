"use client";

import type { SpendingStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CurrencyAmount } from "@/components/ui/CurrencyAmount";
import type { CurrencyCode } from "@/types";
import { convertCurrency } from "@/lib/finance/currency";
import { formatMoney } from "@/lib/constants";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { spendingStatusLabel } from "@/lib/i18n/labels";

export function HeroFinancialCard({
  available,
  baseCurrency,
  localCurrency,
  daily,
  weekly,
  status,
}: {
  available: number;
  baseCurrency: CurrencyCode;
  localCurrency: CurrencyCode;
  daily: number;
  weekly: number;
  status: SpendingStatus;
}) {
  const locale = useAppStore((s) => s.locale);
  const localApprox = convertCurrency(available, baseCurrency, localCurrency);
  const statusVariant =
    status === "on_track" ? "success" : status === "careful" ? "warning" : "danger";

  return (
    <Card
      elevated
      className="relative overflow-hidden space-y-5"
      style={{
        background:
          "linear-gradient(160deg, rgba(26,35,50,0.95), rgba(17,24,39,0.98) 50%, rgba(13,40,40,0.9))",
      }}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="flex items-start justify-between gap-3 relative">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-faint">
            {t(locale, "home.real_available")}
          </p>
          <CurrencyAmount
            amount={available}
            currency={baseCurrency}
            size="xl"
            showCode
            className="mt-2 block"
          />
          <p className="text-sm text-ink-muted mt-1">
            ≈ {formatMoney(localApprox, localCurrency, { showCode: true })}
          </p>
        </div>
        <Badge variant={statusVariant}>{spendingStatusLabel(locale, status)}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 relative">
        <div className="rounded-2xl bg-bg/50 border border-border p-3">
          <p className="text-xs text-ink-faint">{t(locale, "home.safe_to_spend")}</p>
          <p className="font-display text-lg font-semibold mt-1">
            {formatMoney(daily, baseCurrency)}
            <span className="text-xs text-ink-muted font-body font-normal">
              {" "}
              {t(locale, "home.per_day")}
            </span>
          </p>
        </div>
        <div className="rounded-2xl bg-bg/50 border border-border p-3">
          <p className="text-xs text-ink-faint">{t(locale, "home.weekly_drs")}</p>
          <p className="font-display text-lg font-semibold mt-1">
            {formatMoney(weekly, baseCurrency)}
            <span className="text-xs text-ink-muted font-body font-normal">
              {" "}
              {t(locale, "home.per_week")}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}
