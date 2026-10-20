"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { naviAgent } from "@/lib/agent/agent";
import { executeToolAsync } from "@/lib/agent/experienceTools";
import type { ExperienceRecommendationPayload } from "@/lib/agent/types";
import { GENERIC_BASELINE_LABEL } from "@/lib/experiences";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";
import { ExperienceCard } from "./ExperienceCard";
import { WhyThisSheet } from "./WhyThisSheet";

type ViewState = "empty" | "loading" | "match" | "demo" | "error";

export function TonightMatch() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const trip = useAppStore((s) => s.trip);
  const pockets = useAppStore((s) => s.pockets);
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const culturalProfile = useAppStore((s) => s.culturalProfile);
  const askNavi = useAppStore((s) => s.askNavi);

  const [payload, setPayload] = useState<ExperienceRecommendationPayload | null>(null);
  const [state, setState] = useState<ViewState>("empty");
  const [whyOpen, setWhyOpen] = useState(false);

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
      else if (data.qlooSource === "demo" || data.usedBaseline) setState("demo");
      else setState("match");
    });

    return () => {
      cancelled = true;
    };
  }, [trip, pockets, transactions, goals, locale, culturalProfile, consented]);

  const simulateEstimated = async (amount: number) => {
    setWhyOpen(false);
    await askNavi(`What if I spend $${Math.round(amount)}?`);
    router.push("/app/navi");
  };

  if (!trip) return null;

  return (
    <section className="min-w-0 max-w-full space-y-3">
      <h2 className="text-sm font-semibold text-ink break-words">{t(locale, "tonight.title")}</h2>

      {state === "empty" && (
        <Card className="min-w-0 overflow-hidden">
          <p className="text-sm font-medium break-words">{t(locale, "tonight.empty")}</p>
          <p className="mt-1 text-xs text-ink-muted break-words">{t(locale, "tonight.empty_hint")}</p>
        </Card>
      )}

      {state === "loading" && (
        <Card className="min-w-0 overflow-hidden">
          <p className="text-sm text-ink-muted break-words">{t(locale, "tonight.loading")}</p>
        </Card>
      )}

      {state === "error" && (
        <Card className="min-w-0 space-y-2 overflow-hidden">
          <p className="text-sm font-medium break-words">{t(locale, "tonight.error")}</p>
          <p className="text-xs text-ink-faint break-words">{GENERIC_BASELINE_LABEL}</p>
          {payload?.best ? (
            <ExperienceCard experience={payload.best} provenanceLabel={GENERIC_BASELINE_LABEL} />
          ) : null}
        </Card>
      )}

      {state === "demo" && payload?.best && (
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-ink-faint break-words">{t(locale, "tonight.demo")}</p>
          <ExperienceCard experience={payload.best} provenanceLabel={GENERIC_BASELINE_LABEL} />
        </div>
      )}

      {state === "match" && payload?.best && (
        <ExperienceCard experience={payload.best} />
      )}

      {payload?.best && state !== "empty" && state !== "loading" && (
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="min-w-0" onClick={() => setWhyOpen(true)}>
            {t(locale, "tonight.why")}
          </Button>
          <Button
            size="sm"
            className="min-w-0"
            onClick={() => void simulateEstimated(payload.best!.estimatedCost.amount)}
          >
            {t(locale, "tonight.go")}
          </Button>
        </div>
      )}

      <WhyThisSheet
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        experience={payload?.best ?? null}
        alternative={payload?.alternative ?? null}
        usedBaseline={payload?.usedBaseline}
        onSimulate={(amount) => void simulateEstimated(amount)}
      />
    </section>
  );
}
