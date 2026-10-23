"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { naviAgent } from "@/lib/agent/agent";
import { executeToolAsync } from "@/lib/agent/experienceTools";
import { formatExperiencePlaceLabel, whatIfSpendText } from "@/lib/agent/purchaseLabel";
import type { ExperienceRecommendationPayload } from "@/lib/agent/types";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";
import { ExperienceCard } from "./ExperienceCard";
import { TasteCompareSheet } from "./TasteCompareSheet";
import { WhyThisSheet } from "./WhyThisSheet";

type ViewState = "empty" | "loading" | "match" | "demo" | "error" | "filter_empty" | "signals_empty";

export function TonightMatch() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
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
  const goals = useAppStore(function (s) {
    return s.goals;
  });
  const culturalProfile = useAppStore(function (s) {
    return s.culturalProfile;
  });
  const askNavi = useAppStore(function (s) {
    return s.askNavi;
  });

  const [payload, setPayload] = useState(null as ExperienceRecommendationPayload | null);
  const [state, setState] = useState("empty" as ViewState);
  const [whyOpen, setWhyOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const consented = Boolean(culturalProfile?.consent.granted);

  useEffect(() => {
    if (!trip || !consented) {
      setPayload(null);
      setState("empty");
      return;
    }

    let cancelled = false;
    setState("loading");

    void executeToolAsync(
      "recommendExperience",
      { city: trip.city, intent: "tonight" },
      {
        trip,
        pockets,
        transactions,
        goals,
        locale,
        culturalProfile,
        lastRecommendation: naviAgent.lastRecommendation,
      }
    ).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setState("error");
        setPayload(null);
        return;
      }
      const data = result.data as ExperienceRecommendationPayload;
      naviAgent.lastRecommendation = data;
      setPayload(data);
      if (data.qlooSource === "unavailable") setState("error");
      else if (data.qlooSource === "skipped" || data.missingConsent || data.missingProfile) {
        setState("empty");
      } else if ((data.qlooSource === "demo" || data.usedBaseline) && data.best) {
        setState("demo");
      } else if (data.qlooSource === "demo" && !data.best) {
        setState("error");
      } else if (data.emptyFilter || !data.best) {
        setState("signals_empty");
      } else {
        setState("match");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [trip, pockets, transactions, goals, locale, culturalProfile, consented]);

  const simulateEstimated = async (amount: number, placeLabel?: string | null) => {
    setWhyOpen(false);
    setCompareOpen(false);
    await askNavi(whatIfSpendText(amount, placeLabel));
    router.push("/app/navi");
  };

  if (!trip) return null;

  const panelKey = `${state}-${payload?.best?.id ?? "none"}`;
  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 }, exit: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

  return (
    <section className="min-w-0 max-w-full space-y-3">
      <h2 className="text-sm font-semibold text-ink break-words">{t(locale, "tonight.title")}</h2>

      <AnimatePresence mode="wait">
        <motion.div key={panelKey} className="min-w-0" {...motionProps}>
          {state === "empty" && (
            <Card className="min-w-0 overflow-hidden">
              <p className="text-sm font-medium break-words">{t(locale, "tonight.empty")}</p>
              <p className="mt-1 text-xs text-ink-muted break-words">{t(locale, "tonight.empty_hint")}</p>
            </Card>
          )}

          {state === "loading" && (
            <Card className="min-w-0 space-y-3 overflow-hidden" aria-busy="true">
              <p className="sr-only">{t(locale, "tonight.loading")}</p>
              <div className="space-y-2">
                <span className="block h-4 w-2/3 animate-pulse rounded-md bg-accent-soft" />
                <span className="block h-16 w-full animate-pulse rounded-xl bg-surface-elevated" />
                <span className="block h-3 w-1/2 animate-pulse rounded-md bg-accent-soft" />
              </div>
            </Card>
          )}

          {state === "error" && (
            <Card className="min-w-0 space-y-2 overflow-hidden">
              {payload?.best ? (
                <>
                  <p className="text-sm font-medium break-words">{t(locale, "tonight.error")}</p>
                  <p className="text-xs text-ink-faint break-words">
                    {t(locale, "experience.generic_not_qloo")}
                  </p>
                  <ExperienceCard
                    experience={payload.best}
                    provenanceLabel={t(locale, "experience.generic_not_qloo")}
                  />
                </>
              ) : (
                <p className="text-sm font-medium break-words">{t(locale, "tonight.unavailable")}</p>
              )}
            </Card>
          )}

          {state === "demo" && payload?.best && (
            <div className="min-w-0 space-y-2">
              <p className="text-xs text-ink-faint break-words">{t(locale, "tonight.demo")}</p>
              <ExperienceCard
                experience={payload.best}
                provenanceLabel={t(locale, "experience.generic_not_qloo")}
              />
            </div>
          )}

          {state === "filter_empty" || state === "signals_empty" ? (
            <Card className="min-w-0 overflow-hidden">
              <p className="text-sm font-medium break-words">
                {t(locale, "tonight.signals_empty", { city: trip.city })}
              </p>
            </Card>
          ) : null}

          {state === "match" && payload?.best && (
            <ExperienceCard experience={payload.best} />
          )}
        </motion.div>
      </AnimatePresence>

      {payload?.best && state !== "empty" && state !== "loading" && (
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="min-h-10 min-w-0" onClick={() => setWhyOpen(true)}>
            {t(locale, "tonight.why")}
          </Button>
          <Button
            size="sm"
            className="min-h-10 min-w-0"
            onClick={() =>
              void simulateEstimated(
                payload.best!.estimatedCost.amount,
                formatExperiencePlaceLabel(payload.best!)
              )
            }
          >
            {t(locale, "tonight.go")}
          </Button>
        </div>
      )}

      <Button
        size="sm"
        variant="secondary"
        className="h-auto min-h-10 min-w-0 max-w-full whitespace-normal break-words"
        onClick={function () {
          setCompareOpen(true);
        }}
      >
        {t(locale, "tonight.compare")}
      </Button>

      <WhyThisSheet
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        experience={payload?.best ?? null}
        alternative={payload?.alternative ?? null}
        usedBaseline={payload?.usedBaseline}
        onSimulate={(amount, placeLabel) => void simulateEstimated(amount, placeLabel)}
      />
      <TasteCompareSheet
        open={compareOpen}
        onClose={function () {
          setCompareOpen(false);
        }}
        onSimulate={function (amount, placeLabel) {
          void simulateEstimated(amount, placeLabel);
        }}
      />
    </section>
  );
}
