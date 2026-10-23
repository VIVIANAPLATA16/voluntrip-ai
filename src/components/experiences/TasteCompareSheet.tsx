"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { prepareDemoBudgetContext } from "@/lib/demo/remainingDays";
import {
  canCompareTaste,
  compareTaste,
  type CompareTasteColumn,
  type CompareTasteResult,
  type Experience,
} from "@/lib/experiences";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { formatExperiencePlaceLabel } from "@/lib/agent/purchaseLabel";
import { fetchQlooPlaces } from "@/lib/qloo/apiFetch";
import { useAppStore } from "@/store/appStore";
import { ExperienceCard } from "./ExperienceCard";

export function TasteCompareSheet({
  open,
  onClose,
  onSimulate,
}: {
  open: boolean;
  onClose: () => void;
  onSimulate: (amount: number, placeLabel?: string | null) => void;
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

  const [result, setResult] = useState(null as CompareTasteResult | null);
  const [loading, setLoading] = useState(false);

  useEffect(
    function () {
      if (!open || !trip) return;
      let cancelled = false;
      setResult(null);

      if (!canCompareTaste(culturalProfile)) {
        setLoading(false);
        setResult({ kind: "needs_consent", city: trip.city });
        return;
      }

      setLoading(true);
      const aligned = prepareDemoBudgetContext(trip);
      void compareTaste({
        city: trip.city,
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
    [open, trip, pockets, transactions, culturalProfile]
  );

  if (!trip) return null;

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(locale, "tonight.compare")}
      className="min-w-0 max-w-[360px] md:max-w-3xl"
    >
      <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
        {loading ? <CompareSkeleton locale={locale} /> : null}

        {!loading && result?.kind === "needs_consent" ? (
          <Card className="min-w-0 overflow-hidden">
            <p className="text-sm break-words">{t(locale, "tonight.compare.needs_consent")}</p>
          </Card>
        ) : null}

        {!loading && result?.kind === "ready" ? (
          <motion.div className="min-w-0 space-y-4" {...motionProps}>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
              <CompareColumn
                title={t(locale, "tonight.compare.without")}
                caption={t(locale, "tonight.compare.default_ranking")}
                column={result.without}
                city={result.city}
                locale={locale}
                emptyKey="tonight.compare.empty"
                onSimulate={onSimulate}
              />
              <CompareColumn
                title={t(locale, "tonight.compare.with")}
                caption={
                  result.signals.length > 0
                    ? t(locale, "experience.signals_sent", {
                        signals: result.signals.join(", "),
                      })
                    : t(locale, "tonight.compare.with")
                }
                column={result.withTaste}
                city={result.city}
                locale={locale}
                emptyKey="tonight.signals_empty"
                onSimulate={onSimulate}
              />
            </div>
            {result.changedCount !== null ? (
              <p className="text-sm font-medium text-ink break-words">
                {t(locale, "tonight.compare.changed", { count: result.changedCount })}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function CompareSkeleton({ locale }: { locale: Locale }) {
  return (
    <div className="min-w-0 space-y-3" aria-busy="true">
      <p className="sr-only">{t(locale, "tonight.loading")}</p>
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <ColumnSkeleton />
        <ColumnSkeleton />
      </div>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <Card className="min-w-0 space-y-3 overflow-hidden">
      <span className="block h-4 w-1/2 animate-pulse rounded-md bg-accent-soft" />
      <span className="block h-16 w-full animate-pulse rounded-xl bg-surface-elevated" />
      <span className="block h-16 w-full animate-pulse rounded-xl bg-surface-elevated" />
      <span className="block h-16 w-full animate-pulse rounded-xl bg-surface-elevated" />
    </Card>
  );
}

function CompareColumn({
  title,
  caption,
  column,
  city,
  locale,
  emptyKey,
  onSimulate,
}: {
  title: string;
  caption: string;
  column: CompareTasteColumn;
  city: string;
  locale: Locale;
  emptyKey: "tonight.compare.empty" | "tonight.signals_empty";
  onSimulate: (amount: number, placeLabel?: string | null) => void;
}) {
  return (
    <section className="min-w-0 max-w-full space-y-2">
      <h3 className="text-sm font-semibold text-ink break-words">{title}</h3>
      {column.status === "ok" ? (
        <p className="text-xs text-ink-muted break-words">{caption}</p>
      ) : null}
      {column.status === "unavailable" ? (
        <Card className="min-w-0 overflow-hidden">
          <p className="text-sm break-words">{t(locale, "tonight.unavailable")}</p>
        </Card>
      ) : null}
      {column.status === "empty" ? (
        <Card className="min-w-0 overflow-hidden">
          <p className="text-sm break-words">{t(locale, emptyKey, { city: city })}</p>
        </Card>
      ) : null}
      {column.status === "ok"
        ? column.places.map(function (place: Experience) {
            return (
              <div key={place.id || place.name} className="min-w-0 space-y-2">
                <ExperienceCard experience={place} />
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-10 min-w-0 max-w-full whitespace-normal"
                  onClick={function () {
                    onSimulate(
                      place.estimatedCost.amount,
                      formatExperiencePlaceLabel(place)
                    );
                  }}
                >
                  {t(locale, "tonight.go")}
                </Button>
              </div>
            );
          })
        : null}
    </section>
  );
}
