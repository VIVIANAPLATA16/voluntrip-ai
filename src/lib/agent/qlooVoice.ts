import { qlooEvidenceForSheet } from "@/lib/experiences/whyQlooEvidence";
import { whyThisDetails } from "@/lib/experiences/whyThisDetails";
import type { Experience } from "@/lib/experiences";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { formatExperiencePlaceLabel } from "./purchaseLabel";

export function tastePhrase(signals: readonly string[], entities: readonly string[]): string {
  return [...signals, ...entities].map(function (part) {
    return part.trim();
  }).filter(Boolean).join(", ");
}

/**
 * Natural-language Qloo cite from the same evidence as the Why this? modal.
 * Never invents rank, signals, or tag matches. Never emits entity UUIDs.
 */
export function naviQlooCite(
  locale: Locale,
  experience: Experience,
  usedBaseline = false
): { showAsQloo: boolean; text: string } {
  const evidence = qlooEvidenceForSheet(experience.whyQloo, usedBaseline);
  const details = whyThisDetails(experience, usedBaseline);
  const place = formatExperiencePlaceLabel(experience) ?? experience.name;
  const source = evidence.showAsQloo
    ? "qloo"
    : usedBaseline
      ? `${evidence.source} (${t(locale, "experience.generic_not_qloo")})`
      : evidence.source;

  if (!evidence.showAsQloo) {
    return {
      showAsQloo: false,
      text: t(locale, "navi.voice.not_qloo", { place, source }),
    };
  }

  const taste = tastePhrase(evidence.signals, details.entities);
  if (details.rankedByLovedEntities) {
    return {
      showAsQloo: true,
      text: t(locale, "navi.voice.qloo_loved", {
        place,
        rank: evidence.rank,
        total: evidence.totalResults,
        entities: details.entities.join(", "),
        source,
      }),
    };
  }

  if (taste) {
    return {
      showAsQloo: true,
      text: t(locale, "navi.voice.qloo_rank", {
        place,
        rank: evidence.rank,
        total: evidence.totalResults,
        taste,
        source,
      }),
    };
  }

  return {
    showAsQloo: true,
    text: t(locale, "navi.voice.qloo_rank_plain", {
      place,
      rank: evidence.rank,
      total: evidence.totalResults,
      source,
    }),
  };
}
