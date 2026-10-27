"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { HeroFinancialCard } from "@/components/finance/HeroFinancialCard";
import { TripProgress } from "@/components/ui/TripProgress";
import { MoneyRunwayCard } from "@/components/finance/MoneyRunwayCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { PocketCard } from "@/components/ui/PocketCard";
import { TransactionItem } from "@/components/ui/TransactionItem";
import { Badge } from "@/components/ui/Badge";
import { t } from "@/lib/i18n/dictionaries";
import Link from "next/link";
import { generateInsight } from "@/lib/ai/azureOpenAI";
import type { AIInsight } from "@/types";
import { WifiOff } from "lucide-react";
import { TasteSummaryCard } from "@/components/culture/TasteSummaryCard";
import { TonightMatch } from "@/components/experiences/TonightMatch";
import { StretchPlanCard } from "@/components/experiences/StretchPlanCard";

export function HomeDashboard() {
  const trip = useAppStore((s) => s.trip);
  const profile = useAppStore((s) => s.profile);
  const pockets = useAppStore((s) => s.pockets);
  const transactions = useAppStore((s) => s.transactions);
  const insights = useAppStore((s) => s.insights);
  const offline = useAppStore((s) => s.offline);
  const locale = useAppStore((s) => s.locale);
  const getSnapshot = useAppStore((s) => s.getSnapshot);
  const getRunway = useAppStore((s) => s.getRunway);
  const [liveInsight, setLiveInsight] = useState<AIInsight | null>(null);

  const snapshot = getSnapshot();
  const runway = getRunway();

  useEffect(() => {
    if (!trip || !snapshot) return;
    let cancelled = false;
    void generateInsight(
      snapshot.status,
      snapshot.averageDailySpend,
      snapshot.dailySafeSpend,
      locale
    )
      .then((res) => {
        if (cancelled) return;
        setLiveInsight({
          id: "live-insight",
          tripId: trip.id,
          type: res.type,
          title: res.title,
          message: res.message,
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        /* generateInsight never throws; keep UI calm if something else fails */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when key budget signals change
  }, [trip?.id, snapshot?.status, snapshot?.averageDailySpend, snapshot?.dailySafeSpend, locale]);

  if (!trip || !snapshot || !runway) return null;

  const displayInsight = liveInsight || insights[0];

  return (
    <div className="min-w-0 max-w-full space-y-5 pb-4 overflow-x-hidden">
      <header className="flex items-center justify-between gap-3">
        <Logo size="sm" href="/app" />
        <div className="flex items-center gap-2">
          {offline ? (
            <Badge variant="warning">
              <WifiOff className="h-3 w-3" aria-hidden />
              {t(locale, "home.offline")}
            </Badge>
          ) : (
            <Badge variant="success">{t(locale, "home.sync_ready")}</Badge>
          )}
          <Avatar name={profile?.displayName || "V"} hue={profile?.avatarHue} />
        </div>
      </header>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
          {t(locale, "home.destination")}
        </p>
        <p className="font-display text-xl font-semibold mt-1">
          {trip.city} {trip.flag}
        </p>
      </div>

      <HeroFinancialCard
        available={snapshot.realAvailable}
        baseCurrency={trip.baseCurrency}
        localCurrency={trip.localCurrency}
        daily={snapshot.dailySafeSpend}
        weekly={snapshot.weeklySafeSpend}
        status={snapshot.status}
      />

      <TonightMatch />
      <StretchPlanCard />
      <TasteSummaryCard />

      <div className="rounded-card border border-border bg-surface/70 p-4">
        <TripProgress trip={trip} />
      </div>

      <MoneyRunwayCard runway={runway} />

      {displayInsight && <InsightCard insight={displayInsight} />}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t(locale, "home.pockets_preview")}</h2>
          <Link href="/app/pockets" className="text-xs text-accent touch-target inline-flex items-center">
            {t(locale, "home.see_all")}
          </Link>
        </div>
        <div className="space-y-3">
          {pockets.slice(0, 3).map((p) => (
            <PocketCard key={p.id} pocket={p} currency={trip.baseCurrency} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t(locale, "home.recent_activity")}</h2>
          <Link href="/app/activity" className="text-xs text-accent touch-target inline-flex items-center">
            {t(locale, "home.see_all")}
          </Link>
        </div>
        <div className="rounded-card border border-border bg-surface/70 px-4">
          {transactions.slice(0, 4).map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))}
          {transactions.length === 0 && (
            <p className="py-6 text-sm text-ink-faint text-center">
              {t(locale, "home.no_activity_yet")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
