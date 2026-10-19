import { formatMoney } from "@/lib/constants";
import { GENERIC_BASELINE_LABEL } from "@/lib/experiences";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { ToolResult } from "./tools";
import type { ExperienceRecommendationPayload } from "./types";
import type { Experience } from "@/lib/experiences";

function estimatedCostLabel(locale: Locale, experience: Experience): string {
  return t(locale, "navi.experience.estimated_cost", {
    cost: formatMoney(experience.estimatedCost.amount, "USD", { showCode: true }),
  });
}

function fromQlooBlock(locale: Locale, experience: Experience, payload: ExperienceRecommendationPayload): string {
  const tags =
    experience.whyQloo.matchedTags.length > 0
      ? experience.whyQloo.matchedTags.join(", ")
      : t(locale, "navi.experience.no_matched_tags");
  const source =
    payload.usedBaseline || experience.whyQloo.source !== "qloo"
      ? `${experience.whyQloo.source} (${payload.baselineLabel ?? GENERIC_BASELINE_LABEL})`
      : experience.whyQloo.source;
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

export function formatExperienceToolReply(
  locale: Locale,
  tool: "recommendExperience" | "explainRecommendation" | "findBetterOption",
  result: ToolResult
): string {
  if (!result.ok) {
    return result.error || t(locale, "navi.experience.no_best");
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
