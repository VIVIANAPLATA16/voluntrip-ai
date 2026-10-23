import { formatMoney } from "@/lib/constants";
import { foldPlaceName } from "@/lib/experiences";
import type { Experience } from "@/lib/experiences";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { PurchaseSimulation } from "@/types";
import { whyThisDetails } from "@/lib/experiences/whyThisDetails";
import { qlooEvidenceForSheet } from "@/lib/experiences/whyQlooEvidence";
import { naviQlooCite, tastePhrase } from "./qlooVoice";
import { sanitizePlaceLabel } from "./purchaseLabel";

export const MY_DAY_MAX_STOPS = 3;
export const MY_DAY_MIN_QLOO = 3;

export type MyDayPlanKind =
  | "needs_profile"
  | "needs_consent"
  | "unavailable"
  | "demo"
  | "empty"
  | "too_few"
  | "none_fit"
  | "ready";

export type MyDayHonestKind =
  | "needs_profile"
  | "needs_consent"
  | "unavailable"
  | "demo"
  | "empty"
  | "too_few"
  | "none_fit";

export type MyDayHonestPlan = {
  kind: MyDayHonestKind;
  city: string;
  dailySafe: number;
  currency: string;
  reason?: string;
  found?: number;
};

export type MyDayReadyPlan = {
  kind: "ready";
  city: string;
  stops: Experience[];
  total: number;
  dailySafe: number;
  simulation: PurchaseSimulation;
  concept: string;
};

export type MyDayPlan = MyDayHonestPlan | MyDayReadyPlan;

export function matchingDayPlanConcept(
  plan: MyDayPlan | null | undefined,
  amount: number
): string | null {
  if (plan?.kind !== "ready") return null;
  if (Math.round(plan.simulation.purchaseAmount) !== Math.round(amount)) return null;
  return plan.concept;
}

export function distinctByFoldedName(places: readonly Experience[]): Experience[] {
  const seen = new Set<string>();
  const out: Experience[] = [];
  for (const place of places) {
    const key = foldPlaceName(place.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

/** Greedy fill in rank order: up to 3 unique names whose estimated costs fit daily safe. */
export function pickDayStops(
  ranked: readonly Experience[],
  dailySafe: number,
  max = MY_DAY_MAX_STOPS
): Experience[] {
  const unique = distinctByFoldedName(ranked);
  const picked: Experience[] = [];
  let sum = 0;
  for (const place of unique) {
    if (picked.length >= max) break;
    const cost = place.estimatedCost.amount;
    if (!(cost > 0)) continue;
    if (sum + cost > dailySafe) continue;
    picked.push(place);
    sum += cost;
  }
  return picked;
}

export function dayPlanTotal(stops: readonly Experience[]): number {
  return Math.round(
    stops.reduce(function (sum, place) {
      return sum + place.estimatedCost.amount;
    }, 0) * 100
  ) / 100;
}

export function dayPlanConcept(locale: Locale, stops: readonly Experience[]): string {
  const names = stops
    .map(function (place) {
      return sanitizePlaceLabel(place.name);
    })
    .filter(function (name): name is string {
      return Boolean(name);
    });
  return (
    sanitizePlaceLabel(t(locale, "navi.myday.concept", { stops: names.join(", ") })) ??
    t(locale, "navi.myday.concept", { stops: names.join(", ") })
  );
}

function sourceWord(locale: Locale): string {
  return t(locale, "navi.voice.source");
}

function dailySafeLine(locale: Locale, dailySafe: number, currency: string): string {
  return t(locale, "navi.myday.today_safe", {
    daily: formatMoney(dailySafe, currency, { showCode: true }),
  });
}

export function formatMyDayReply(locale: Locale, plan: MyDayPlan): string {
  if (plan.kind !== "ready") {
    const daily = dailySafeLine(locale, plan.dailySafe, plan.currency);
    const honest =
      plan.kind === "needs_profile"
        ? t(locale, "navi.myday.no_profile")
        : plan.kind === "needs_consent"
          ? t(locale, "navi.myday.no_consent")
          : plan.kind === "unavailable"
            ? t(locale, "navi.myday.unavailable", { reason: plan.reason ?? "QLOO_NETWORK" })
            : plan.kind === "demo"
              ? t(locale, "navi.myday.demo")
              : plan.kind === "none_fit"
                ? t(locale, "navi.myday.none_fit", {
                    city: plan.city,
                    daily: formatMoney(plan.dailySafe, plan.currency, { showCode: true }),
                  })
                : t(locale, "navi.myday.too_few", {
                    city: plan.city,
                    found: plan.found ?? 0,
                  });
    return [honest, daily].filter(Boolean).join("\n");
  }

  const currency = plan.simulation.purchaseCurrency;
  const lines = plan.stops.map(function (place, index) {
    return t(locale, "navi.myday.stop", {
      n: index + 1,
      name: place.name,
      cost: formatMoney(place.estimatedCost.amount, currency, { showCode: true }),
    });
  });

  const note =
    plan.stops.length >= 3
      ? ""
      : plan.stops.length === 2
        ? t(locale, "navi.myday.only_two")
        : t(locale, "navi.myday.only_one");

  const first = plan.stops[0];
  const evidence = qlooEvidenceForSheet(first.whyQloo, false);
  const details = whyThisDetails(first, false);
  const ranks = plan.stops
    .map(function (place) {
      return t(locale, "navi.myday.rank", {
        n: place.whyQloo.rank,
        m: place.whyQloo.totalResults,
      });
    })
    .join(", ");
  const taste = tastePhrase(evidence.signals, details.entities);
  const qlooLine = !evidence.showAsQloo
    ? naviQlooCite(locale, first, false).text
    : details.rankedByLovedEntities
      ? t(locale, "navi.myday.qloo_loved", {
          ranks,
          entities: details.entities.join(", "),
          sourceWord: sourceWord(locale),
          source: "qloo",
        })
      : taste
        ? t(locale, "navi.myday.qloo", {
            ranks,
            taste,
            sourceWord: sourceWord(locale),
            source: "qloo",
          })
        : t(locale, "navi.myday.qloo_plain", {
            ranks,
            sourceWord: sourceWord(locale),
            source: "qloo",
          });

  const protectedLabel = plan.simulation.affordable
    ? t(locale, "navi.experience.protected_yes")
    : t(locale, "navi.experience.protected_no");
  const runwayKey =
    first.whyVoluntrip.runwayStatus === "careful"
      ? "status.careful"
      : first.whyVoluntrip.runwayStatus === "at_risk"
        ? "status.at_risk"
        : "status.on_track";

  return [
    t(locale, "navi.myday.headline", {
      city: plan.city,
      count: plan.stops.length,
    }),
    note,
    lines.join("\n"),
    qlooLine,
    t(locale, "navi.myday.total", {
      total: formatMoney(plan.simulation.purchaseAmount, currency, { showCode: true }),
    }),
    t(locale, "navi.myday.budget", {
      dailyBefore: formatMoney(plan.simulation.dailyBudgetBefore, currency),
      dailyAfter: formatMoney(plan.simulation.dailyBudgetAfter, currency),
      protected: protectedLabel,
      runway: t(locale, runwayKey),
    }),
  ]
    .filter(Boolean)
    .join("\n");
}
