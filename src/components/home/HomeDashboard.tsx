"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { Logo } from "@/components/ui/Logo";
import { HeroFinancialCard } from "@/components/finance/HeroFinancialCard";
import { TripProgress } from "@/components/ui/TripProgress";
import { MoneyRunwayCard } from "@/components/finance/MoneyRunwayCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { PocketCard } from "@/components/ui/PocketCard";
import { TransactionItem } from "@/components/ui/TransactionItem";
import { Badge } from "@/components/ui/Badge";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import Link from "next/link";
import { generateInsight } from "@/lib/ai/azureOpenAI";
import type { AIInsight } from "@/types";
import { Heart, WifiOff } from "lucide-react";
import {
  TasteSummaryCard,
  tasteProfileAvatarProps,
} from "@/components/culture/TasteSummaryCard";
import { TonightMatch } from "@/components/experiences/TonightMatch";
import { StretchPlanCard } from "@/components/experiences/StretchPlanCard";
import { GroupsCard } from "@/components/groups/GroupsCard";

/** Same turquoise disc Avatar uses at hue 168; 44px hit area. */
const CIRCLE_CLASS_PARTS = [
  "inline-flex",
  "h-11",
  "w-11",
  "min-h-11",
  "min-w-11",
  "rounded-full",
  "flex",
  "items-center",
  "justify-center",
  "font-display",
  "font-semibold",
  "text-bg",
] as const;

/** Header Taste-profile control: centered heart, no initial, no corner badge. */
export function tasteHeaderAvatar(locale: Locale) {
  const props = tasteProfileAvatarProps(locale);
  return {
    href: props.href,
    "aria-label": props["aria-label"],
    initial: null,
    icon: "heart" as const,
    iconAriaHidden: true,
    circleClassName: CIRCLE_CLASS_PARTS.join(" "),
    circleBackground: `linear-gradient(135deg, hsl(${168} 70% 45%), hsl(${198} 60% 35%))`,
    heartClassName: ["h-5", "w-5", "text-bg", "fill-current"].join(" "),
  };
}

export function HomeDashboard() {
  const trip = useAppStore((s) => s.trip);
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
  const profileLink = tasteHeaderAvatar(locale);

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
          <Link
            href={profileLink.href}
            aria-label={profileLink["aria-label"]}
            className={`${profileLink.circleClassName} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none`}
            style={{ background: profileLink.circleBackground }}
          >
            <Heart className={profileLink.heartClassName} aria-hidden />
          </Link>
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
      <GroupsCard />
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
