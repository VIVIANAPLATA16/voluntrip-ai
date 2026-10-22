"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/constants";
import { prepareDemoBudgetContext } from "@/lib/demo/remainingDays";
import { buildBudgetSnapshot } from "@/lib/finance/budget";
import {
  qlooEvidenceForSheet,
  requestStretchPlan,
  swapStretchNight,
  type StretchNights,
  type StretchPlanReady,
  type StretchPlanResult,
  type StretchPlanVersion,
} from "@/lib/experiences";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { spendingStatusLabel } from "@/lib/i18n/labels";
import { fetchQlooPlaces } from "@/lib/qloo/apiFetch";
import { useAppStore } from "@/store/appStore";

export function StretchPlanSheet({
  open,
  nights,
  onClose,
  onSimulate,
}: {
  open: boolean;
  nights: StretchNights;
  onClose: () => void;
  onSimulate: (amount: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const trip = useAppStore(function (s) {
    return s.trip;
  });
  const pockets = useAppStore(function (s) {
    return s.pockets;
  });
  const transactions = useAppStore(function (s) {
    return s.transactions;
  });
  const culturalProfile = useAppStore(function (s) {
    return s.culturalProfile;
  });

  const [result, setResult] = useState(null as StretchPlanResult | null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("stretched" as "best" | "stretched");
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(
    function () {
      if (!open || !trip) return;
      let cancelled = false;
      setResult(null);
      setLoading(true);
      const aligned = prepareDemoBudgetContext(trip);
      void requestStretchPlan({
        city: trip.city,
        nights: nights,
        trip: aligned.trip,
        transactions: transactions,
        pockets: pockets,
        culturalProfile: culturalProfile,
        searchPlaces: fetchQlooPlaces,
        now: aligned.now,
      }).then(function (next) {
        if (cancelled) return;
        setResult(next);
        setLoading(false);
      });
      return function () {
        cancelled = true;
      };
    },
    [open, nights, trip, pockets, transactions, culturalProfile]
  );

  if (!trip) return null;

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };

  const ready = result?.kind === "ready" ? result : null;
  const version = ready ? ready[tab] : null;

  function swapNight(index: number) {
    if (!ready || !trip) return;
    const aligned = prepareDemoBudgetContext(trip);
    const snapshot = buildBudgetSnapshot(aligned.trip, transactions, pockets, aligned.now);
    setResult(
      swapStretchNight(ready, tab, index, {
        snapshot: snapshot,
        trip: aligned.trip,
        transactions: transactions,
        pockets: pockets,
        now: aligned.now,
      })
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(locale, "stretch.title")}
      className="min-w-0 max-w-[360px] md:max-w-2xl"
    >
      <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
        {loading ? (
          <div className="min-w-0 space-y-3" aria-busy="true">
            <p className="sr-only">{t(locale, "stretch.loading")}</p>
            <span className="block h-4 w-2/3 animate-pulse rounded-md bg-accent-soft" />
            <span className="block h-20 w-full animate-pulse rounded-xl bg-surface-elevated" />
            <span className="block h-20 w-full animate-pulse rounded-xl bg-surface-elevated" />
          </div>
        ) : null}

        {!loading && result?.kind === "needs_consent" ? (
          <Card className="min-w-0 overflow-hidden">
            <p className="text-sm break-words">{t(locale, "stretch.needs_consent")}</p>
          </Card>
        ) : null}

        {!loading && result?.kind === "unavailable" ? (
          <Card className="min-w-0 overflow-hidden">
            <p className="text-sm break-words">{t(locale, "stretch.unavailable")}</p>
          </Card>
        ) : null}

        {!loading && result?.kind === "empty" ? (
          <Card className="min-w-0 overflow-hidden">
            <p className="text-sm break-words">{t(locale, "stretch.empty", { city: result.city })}</p>
          </Card>
        ) : null}

        {!loading && ready && version ? (
          <motion.div className="min-w-0 space-y-3" {...motionProps}>
            <div className="flex min-w-0 gap-2">
              <Button
                size="sm"
                variant={tab === "best" ? "primary" : "secondary"}
                className="h-auto min-h-10 min-w-0 flex-1 whitespace-normal"
                onClick={function () {
                  setTab("best");
                }}
              >
                {t(locale, "stretch.best")}
              </Button>
              <Button
                size="sm"
                variant={tab === "stretched" ? "primary" : "secondary"}
                className="h-auto min-h-10 min-w-0 flex-1 whitespace-normal"
                onClick={function () {
                  setTab("stretched");
                }}
              >
                {t(locale, "stretch.stretched")}
              </Button>
            </div>

            <PlanSummary locale={locale} plan={ready} version={version} />

            {version.nights.map(function (night, index) {
              const cost = formatMoney(night.place.estimatedCost.amount, "USD", { showCode: true });
              return (
                <Card key={night.place.id + "-" + night.night} padding="sm" className="min-w-0 space-y-2 overflow-hidden">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-ink-faint">{t(locale, "stretch.night", { n: night.night })}</p>
                      <p className="font-display text-sm font-semibold break-words">{night.place.name}</p>
                      {night.place.neighborhood ? (
                        <p className="text-xs text-ink-muted break-words">{night.place.neighborhood}</p>
                      ) : null}
                    </div>
                    <Badge variant="accent">{night.place.source}</Badge>
                  </div>
                  <p className="text-xs break-words">{t(locale, "experience.estimated", { cost: cost })}</p>
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <dt className="text-ink-faint">{t(locale, "experience.cultural_fit")}</dt>
                      <dd className="font-semibold tabular-nums">{night.place.culturalFit}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">{t(locale, "experience.financial_fit")}</dt>
                      <dd className="font-semibold tabular-nums">{night.place.financialFit}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">{t(locale, "experience.value_score")}</dt>
                      <dd className="font-semibold tabular-nums text-accent">{night.place.valueScore}</dd>
                    </div>
                  </dl>
                  {night.weakerFit ? (
                    <p className="text-xs text-ink-faint break-words">{t(locale, "stretch.weaker")}</p>
                  ) : null}
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-auto min-h-10 min-w-0"
                      onClick={function () {
                        swapNight(index);
                      }}
                    >
                      {t(locale, "stretch.swap")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-auto min-h-10 min-w-0"
                      onClick={function () {
                        onSimulate(night.place.estimatedCost.amount);
                      }}
                    >
                      {t(locale, "stretch.simulate_night")}
                    </Button>
                  </div>
                </Card>
              );
            })}

            <Button
              className="h-auto min-h-10 w-full max-w-full whitespace-normal"
              onClick={function () {
                onSimulate(version.totalEstimatedUsd);
              }}
            >
              {t(locale, "stretch.simulate_plan")}
            </Button>
            <Button
              variant="secondary"
              className="h-auto min-h-10 w-full max-w-full whitespace-normal"
              onClick={function () {
                setWhyOpen(true);
              }}
            >
              {t(locale, "stretch.why")}
            </Button>
          </motion.div>
        ) : null}
      </div>

      {ready ? (
        <WhyStretchPlanSheet
          open={whyOpen}
          plan={ready}
          version={version ?? ready.stretched}
          onClose={function () {
            setWhyOpen(false);
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

function PlanSummary({
  locale,
  plan,
  version,
}: {
  locale: Locale;
  plan: StretchPlanReady;
  version: StretchPlanVersion;
}) {
  const total = formatMoney(version.totalDisplay, version.displayCurrency, { showCode: true });
  const savings = formatMoney(plan.savingsDisplay, plan.displayCurrency, { showCode: true });
  return (
    <Card className="min-w-0 space-y-1 overflow-hidden">
      <p className="text-sm font-medium break-words">{t(locale, "stretch.total", { cost: total })}</p>
      {version.kind === "stretched" && plan.identical ? (
        <p className="text-xs text-ink-muted break-words">{t(locale, "stretch.identical")}</p>
      ) : null}
      {version.kind === "stretched" && !plan.identical ? (
        <p className="text-xs text-ink-muted break-words">{t(locale, "stretch.savings", { cost: savings })}</p>
      ) : null}
      {version.kind === "stretched" && plan.rateAvailable && plan.daysEquivalent !== null ? (
        <p className="text-xs text-ink-muted break-words">
          {t(locale, "stretch.days_equiv", { days: plan.daysEquivalent })}
        </p>
      ) : null}
      {plan.shortened ? (
        <p className="text-xs text-ink-muted break-words">
          {t(locale, "stretch.shortened", { used: plan.usedNights, requested: plan.requestedNights })}
        </p>
      ) : null}
      {plan.bothUnaffordable ? (
        <p className="text-xs text-ink-muted break-words">{t(locale, "stretch.unaffordable")}</p>
      ) : null}
    </Card>
  );
}

function WhyStretchPlanSheet({
  open,
  plan,
  version,
  onClose,
}: {
  open: boolean;
  plan: StretchPlanReady;
  version: StretchPlanVersion;
  onClose: () => void;
}) {
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const first = version.nights[0]?.place;
  if (!first) return null;
  const evidence = qlooEvidenceForSheet(first.whyQloo, false);
  const queried = new Date(first.whyQloo.queriedAt).toLocaleString(
    locale === "es" ? "es-CO" : locale === "pt" ? "pt-BR" : "en-US",
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );
  const sim = version.simulation;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(locale, "stretch.why")}
      className="min-w-0 max-w-[360px] md:max-w-lg"
    >
      <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
        <section className="min-w-0 space-y-1 rounded-2xl border border-border bg-surface/70 p-3">
          <h3 className="text-sm font-semibold break-words">{t(locale, "experience.from_qloo")}</h3>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.signals_sent", { signals: plan.signals.join(", ") })}
          </p>
          {plan.filter ? (
            <p className="text-xs text-ink-muted break-words">
              {t(locale, "experience.filtered_by", { label: plan.filter })}
            </p>
          ) : null}
          {version.nights.map(function (night) {
            const nightEvidence = qlooEvidenceForSheet(night.place.whyQloo, false);
            return (
              <p key={night.place.id} className="text-xs text-ink-muted break-words">
                {t(locale, "stretch.night", { n: night.night })}: {night.place.name}
                {" · "}
                {t(locale, nightEvidence.filter ? "experience.ranked_for_filter" : "experience.ranked_for_signals", {
                  rank: nightEvidence.rank,
                  total: nightEvidence.totalResults,
                })}
                {nightEvidence.matchedPlaceTags
                  ? " · " +
                    t(locale, "experience.matched_place_tags", {
                      tags: nightEvidence.matchedPlaceTags.join(", "),
                    })
                  : ""}
              </p>
            );
          })}
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.source")}: {first.whyQloo.source}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.queried_at")}: {queried}
          </p>
          {evidence.showAsQloo ? null : (
            <p className="text-xs text-ink-muted break-words">{t(locale, "experience.not_from_qloo")}</p>
          )}
        </section>

        <section className="min-w-0 space-y-1 rounded-2xl border border-border bg-surface/70 p-3">
          <h3 className="text-sm font-semibold break-words">{t(locale, "experience.from_voluntrip")}</h3>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "stretch.total", {
              cost: formatMoney(version.totalDisplay, version.displayCurrency, { showCode: true }),
            })}
          </p>
          {version.kind === "stretched" ? (
            <p className="text-xs text-ink-muted break-words">
              {t(locale, "stretch.savings", {
                cost: formatMoney(plan.savingsDisplay, plan.displayCurrency, { showCode: true }),
              })}
            </p>
          ) : null}
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.daily_before")}: {formatMoney(sim.dailyBudgetBefore, plan.displayCurrency)}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.daily_after")}: {formatMoney(sim.dailyBudgetAfter, plan.displayCurrency)}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "navi.sim_weekly_now")}: {formatMoney(sim.weeklyBudgetBefore, plan.displayCurrency)}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "navi.sim_weekly_after")}: {formatMoney(sim.weeklyBudgetAfter, plan.displayCurrency)}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.protected")}:{" "}
            {sim.affordable ? t(locale, "navi.experience.protected_yes") : t(locale, "navi.experience.protected_no")}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.runway")}: {spendingStatusLabel(locale, first.whyVoluntrip.runwayStatus)}
          </p>
        </section>
      </div>
    </BottomSheet>
  );
}
