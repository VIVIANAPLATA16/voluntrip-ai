import { formatMoney } from "@/lib/constants";
import { GENERIC_BASELINE_LABEL } from "@/lib/experiences";
import type { Experience, StretchPlanResult } from "@/lib/experiences";
import { matchedTagsKind } from "@/lib/experiences/whyThisDetails";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { ToolResult } from "./tools";
import type { ExperienceRecommendationPayload, NaviResponse } from "./types";

function estimatedCostLabel(locale: Locale, experience: Experience): string {
  return t(locale, "navi.experience.estimated_cost", {
    cost: formatMoney(experience.estimatedCost.amount, "USD", { showCode: true }),
  });
}

function qlooSourceLabel(
  experience: Experience,
  payload: Pick<ExperienceRecommendationPayload, "usedBaseline" | "baselineLabel">
): string {
  return payload.usedBaseline || experience.whyQloo.source !== "qloo"
    ? `${experience.whyQloo.source} (${payload.baselineLabel ?? GENERIC_BASELINE_LABEL})`
    : experience.whyQloo.source;
}

function fromQlooBlock(
  locale: Locale,
  experience: Experience,
  payload: Pick<ExperienceRecommendationPayload, "usedBaseline" | "baselineLabel">
): string {
  const source = qlooSourceLabel(experience, payload);
  const kind = matchedTagsKind(experience.whyQloo);
  if (kind === "loved_entities") {
    return t(locale, "navi.experience.from_qloo_loved", {
      rank: experience.whyQloo.rank,
      source,
    });
  }
  const tags =
    kind === "tags"
      ? experience.whyQloo.matchedTags.join(", ")
      : t(locale, "navi.experience.no_matched_tags");
  return t(locale, "navi.experience.from_qloo", {
    tags,
    rank: experience.whyQloo.rank,
    source,
  });
}

function fromVoluntripBlock(locale: Locale, experience: Experience): string {
  const protectedLabel = experience.whyVoluntrip.protectedMoneyUntouched
    ? t(locale, "navi.experience.protected_yes")
    : t(locale, "navi.experience.protected_no");
  const runwayKey =
    experience.whyVoluntrip.runwayStatus === "careful"
      ? "status.careful"
      : experience.whyVoluntrip.runwayStatus === "at_risk"
        ? "status.at_risk"
        : "status.on_track";
  return t(locale, "navi.experience.from_voluntrip", {
    cost: formatMoney(experience.estimatedCost.amount, "USD", { showCode: true }),
    dailyBefore: formatMoney(experience.whyVoluntrip.dailySafeSpendBefore, "USD"),
    dailyAfter: formatMoney(experience.whyVoluntrip.dailySafeSpendAfter, "USD"),
    protected: protectedLabel,
    runway: t(locale, runwayKey),
  });
}

function introFor(locale: Locale, payload: ExperienceRecommendationPayload): string {
  if (payload.missingProfile) return t(locale, "navi.experience.no_profile");
  if (payload.missingConsent) return t(locale, "navi.experience.no_consent");
  if (payload.qlooSource === "unavailable") {
    return t(locale, "navi.experience.qloo_unavailable", {
      reason: payload.reason ?? "QLOO_NETWORK",
    });
  }
  if (payload.qlooSource === "demo") return t(locale, "navi.experience.qloo_demo");
  return "";
}

function recommendBody(locale: Locale, payload: ExperienceRecommendationPayload): string {
  const intro = introFor(locale, payload);
  if (!payload.best) {
    return [intro, t(locale, "navi.experience.no_best")].filter(Boolean).join("\n\n");
  }

  const place = payload.best.neighborhood ? ` · ${payload.best.neighborhood}` : "";
  const headline = t(locale, "navi.experience.recommend", {
    name: payload.best.name,
    place,
    cost: formatMoney(payload.best.estimatedCost.amount, "USD", { showCode: true }),
    score: payload.best.valueScore,
  });

  const alternative = payload.alternative
    ? t(locale, "navi.experience.alternative", {
        name: payload.alternative.name,
        cost: formatMoney(payload.alternative.estimatedCost.amount, "USD", { showCode: true }),
      })
    : "";

  return [
    intro,
    headline,
    estimatedCostLabel(locale, payload.best),
    fromQlooBlock(locale, payload.best, payload),
    fromVoluntripBlock(locale, payload.best),
    alternative,
    t(locale, "navi.experience.simulate_hint"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatStretchPlanReply(locale: Locale, plan: StretchPlanResult): string {
  if (plan.kind === "needs_consent") return t(locale, "stretch.needs_consent");
  if (plan.kind === "unavailable") return t(locale, "stretch.unavailable");
  if (plan.kind === "empty") return t(locale, "stretch.empty", { city: plan.city });

  const bestNames = plan.best.nights
    .map(function (night) {
      return night.place.name;
    })
    .join(", ");
  const stretchedNames = plan.stretched.nights
    .map(function (night) {
      return night.place.name;
    })
    .join(", ");
  const bestTotal = formatMoney(plan.best.totalDisplay, plan.best.displayCurrency, { showCode: true });
  const stretchedTotal = formatMoney(
    plan.stretched.totalDisplay,
    plan.stretched.displayCurrency,
    { showCode: true }
  );
  const savings = formatMoney(plan.savingsDisplay, plan.displayCurrency, { showCode: true });
  const days =
    plan.rateAvailable && plan.daysEquivalent !== null
      ? t(locale, "stretch.days_equiv", { days: plan.daysEquivalent })
      : "";
  const first = plan.stretched.nights[0]?.place;
  const sim = plan.stretched.simulation;

  return [
    t(locale, "navi.stretch.headline", { city: plan.city, nights: plan.usedNights }),
    t(locale, "navi.stretch.best", { names: bestNames, total: bestTotal }),
    t(locale, "navi.stretch.stretched", { names: stretchedNames, total: stretchedTotal }),
    plan.identical
      ? t(locale, "stretch.identical")
      : t(locale, "navi.stretch.savings", { savings: savings, days: days }),
    plan.shortened
      ? t(locale, "stretch.shortened", { used: plan.usedNights, requested: plan.requestedNights })
      : "",
    plan.bothUnaffordable ? t(locale, "stretch.unaffordable") : "",
    first
      ? matchedTagsKind(first.whyQloo) === "loved_entities"
        ? t(locale, "navi.experience.from_qloo_loved", {
            rank: first.whyQloo.rank,
            source: first.whyQloo.source,
          })
        : t(locale, "navi.experience.from_qloo", {
            tags:
              first.whyQloo.matchedTags.join(", ") ||
              t(locale, "navi.experience.no_matched_tags"),
            rank: first.whyQloo.rank,
            source: first.whyQloo.source,
          })
      : "",
    t(locale, "navi.experience.from_voluntrip", {
      cost: stretchedTotal,
      dailyBefore: formatMoney(sim.dailyBudgetBefore, plan.displayCurrency),
      dailyAfter: formatMoney(sim.dailyBudgetAfter, plan.displayCurrency),
      protected: sim.affordable
        ? t(locale, "navi.experience.protected_yes")
        : t(locale, "navi.experience.protected_no"),
      runway: t(locale, "status.on_track"),
    }),
    t(locale, "navi.experience.simulate_hint"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Local and Azure both copy numbers from the plan object — the model does not recalculate. */
export function applyStretchPlanToNaviResponse(
  locale: Locale,
  response: NaviResponse,
  plan: StretchPlanResult
): NaviResponse {
  return {
    ...response,
    stretchPlan: plan,
    mutations: (response.mutations ?? []).filter(function (mutation) {
      return mutation.type !== "transaction";
    }),
    pendingTransaction: undefined,
    message: {
      ...response.message,
      content: formatStretchPlanReply(locale, plan),
    },
  };
}

export function formatExperienceToolReply(
  locale: Locale,
  tool: "recommendExperience" | "explainRecommendation" | "findBetterOption" | "planStretch",
  result: ToolResult
): string {
  if (!result.ok) {
    return result.error || t(locale, "navi.experience.no_best");
  }

  if (tool === "planStretch") {
    return formatStretchPlanReply(locale, result.data as StretchPlanResult);
  }

  if (tool === "recommendExperience") {
    return recommendBody(locale, result.data as ExperienceRecommendationPayload);
  }

  if (tool === "explainRecommendation") {
    const data = result.data as {
      missing?: boolean;
      best: Experience | null;
      usedBaseline?: boolean;
      baselineLabel?: string;
      qlooSource?: ExperienceRecommendationPayload["qlooSource"];
    };
    if (data.missing || !data.best) return t(locale, "navi.experience.no_last");
    const payload: ExperienceRecommendationPayload = {
      best: data.best,
      alternative: null,
      usedBaseline: Boolean(data.usedBaseline),
      baselineLabel: data.baselineLabel,
      missingProfile: false,
      missingConsent: false,
      qlooSource: data.qlooSource ?? data.best.whyQloo.source,
    };
    return [
      t(locale, "navi.experience.explain", { name: data.best.name }),
      fromQlooBlock(locale, data.best, payload),
      fromVoluntripBlock(locale, data.best),
    ].join("\n\n");
  }

  const data = result.data as { missing?: boolean; alternative: Experience | null };
  if (data.missing) return t(locale, "navi.experience.no_last");
  if (!data.alternative) return t(locale, "navi.experience.no_alternative");
  return t(locale, "navi.experience.alternative", {
    name: data.alternative.name,
    cost: formatMoney(data.alternative.estimatedCost.amount, "USD", { showCode: true }),
  });
}
