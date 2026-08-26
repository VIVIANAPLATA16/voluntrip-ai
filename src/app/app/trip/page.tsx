"use client";

import { Suspense } from "react";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { benefitLabel } from "@/lib/i18n/labels";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TripProgress } from "@/components/ui/TripProgress";
import { MoneyRunwayCard } from "@/components/finance/MoneyRunwayCard";
import { CurrencyConverter } from "@/components/finance/CurrencyConverter";
import { CloudBackupCard } from "@/components/auth/CloudBackupCard";
import { formatMoney } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@/lib/i18n/dictionaries";
import type { HostBenefit, LocaleCode } from "@/types";

export default function TripPage() {
  const trip = useAppStore((s) => s.trip);
  const locale = useAppStore((s) => s.locale);
  const getSnapshot = useAppStore((s) => s.getSnapshot);
  const getRunway = useAppStore((s) => s.getRunway);
  const clearDemo = useAppStore((s) => s.clearDemo);
  const setLocale = useAppStore((s) => s.setLocale);
  const router = useRouter();
  const snapshot = getSnapshot();
  const runway = getRunway();

  if (!trip || !snapshot || !runway) return null;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t(locale, "trip.title")}</h1>

      <Card elevated className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
          {t(locale, "trip.language")}
        </p>
        <div className="flex gap-2">
          {SUPPORTED_LOCALES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={locale === l ? "primary" : "secondary"}
              onClick={() => setLocale(l as LocaleCode)}
            >
              {l.toUpperCase()}
            </Button>
          ))}
        </div>
      </Card>

      <Card elevated className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
          {t(locale, "trip.destination")}
        </p>
        <p className="font-display text-2xl font-semibold">
          {trip.city} {trip.flag}
        </p>
        <p className="text-ink-muted">{trip.country}</p>
        <div className="grid grid-cols-2 gap-3 text-sm pt-2">
          <div>
            <p className="text-ink-faint text-xs">{t(locale, "trip.start")}</p>
            <p>{trip.startDate}</p>
          </div>
          <div>
            <p className="text-ink-faint text-xs">{t(locale, "trip.end")}</p>
            <p>{trip.endDate}</p>
          </div>
          <div>
            <p className="text-ink-faint text-xs">{t(locale, "trip.base")}</p>
            <p>{trip.baseCurrency}</p>
          </div>
          <div>
            <p className="text-ink-faint text-xs">{t(locale, "trip.local")}</p>
            <p>{trip.localCurrency}</p>
          </div>
        </div>
      </Card>

      <div className="rounded-card border border-border bg-surface/70 p-4">
        <TripProgress trip={trip} />
      </div>

      <Card elevated className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">{t(locale, "trip.host")}</p>
        <p className="font-medium">{trip.hostName || t(locale, "trip.not_set")}</p>
        <div className="flex flex-wrap gap-2">
          {trip.includedBenefits.map((b) => (
            <Badge key={b} variant="accent">
              {benefitLabel(locale, b as HostBenefit)}
            </Badge>
          ))}
          {trip.includedBenefits.length === 0 && (
            <p className="text-sm text-ink-faint">{t(locale, "trip.no_benefits")}</p>
          )}
        </div>
      </Card>

      <Card elevated className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">{t(locale, "trip.budget")}</p>
        <p className="font-display text-xl font-semibold">
          {formatMoney(trip.initialBudget, trip.baseCurrency, { showCode: true })}
        </p>
        <p className="text-sm text-ink-muted">
          {t(locale, "trip.real_available_label")}:{" "}
          {formatMoney(snapshot.realAvailable, trip.baseCurrency, { showCode: true })}
        </p>
      </Card>

      <MoneyRunwayCard runway={runway} />
      <CurrencyConverter
        defaultFrom={trip.localCurrency}
        defaultTo={trip.baseCurrency}
        extra={["COP", "EUR", "BRL"]}
      />

      <Suspense fallback={null}>
        <CloudBackupCard />
      </Suspense>

      <Button
        variant="danger"
        className="w-full"
        onClick={async () => {
          await clearDemo();
          router.replace("/onboarding");
        }}
      >
        {t(locale, "trip.reset_data")}
      </Button>
    </div>
  );
}
