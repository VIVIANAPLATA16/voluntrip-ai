"use client";

import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatMoney } from "@/lib/constants";
import { spendingStatusLabel } from "@/lib/i18n/labels";
import { whyThisDetails } from "@/lib/experiences/whyThisDetails";
import { t } from "@/lib/i18n/dictionaries";
import { GENERIC_BASELINE_LABEL, type Experience } from "@/lib/experiences";
import { useAppStore } from "@/store/appStore";
import { ExperienceCard } from "./ExperienceCard";

export function WhyThisSheet({
  open,
  onClose,
  experience,
  alternative,
  usedBaseline = false,
  onSimulate,
}: {
  open: boolean;
  onClose: () => void;
  experience: Experience | null;
  alternative: Experience | null;
  usedBaseline?: boolean;
  onSimulate: (amount: number) => void;
}) {
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  if (!experience) return null;

  const details = whyThisDetails(experience, usedBaseline);
  const evidence = details.evidence;
  const sourceLabel = usedBaseline
    ? `${evidence.source} (${GENERIC_BASELINE_LABEL})`
    : evidence.source;

  return (
    <BottomSheet open={open} onClose={onClose} title={t(locale, "tonight.why")}>
      <div className="min-w-0 max-w-[360px] space-y-4 overflow-x-hidden overflow-y-auto motion-reduce:transition-none">
        <p className="text-sm font-medium text-ink break-words">
          {t(locale, "experience.why_heading", { name: details.name })}
        </p>
        <ExperienceCard experience={experience} />

        <section className="min-w-0 space-y-2 text-sm">
          <h3 className="font-semibold break-words">
            {t(locale, evidence.showAsQloo ? "experience.from_qloo" : "experience.not_from_qloo")}
          </h3>
          {evidence.showAsQloo && evidence.signals.length > 0 ? (
            <p className="text-ink-muted break-words">
              {t(locale, "experience.signals_sent", {
                signals: evidence.signals.join(", "),
              })}
            </p>
          ) : null}
          {evidence.showAsQloo && details.entities.length > 0 ? (
            <p className="text-ink-muted break-words">
              {t(locale, "experience.entities_sent", {
                names: details.entities.join(", "),
              })}
            </p>
          ) : null}
          {evidence.filter ? (
            <p className="text-ink-muted break-words">
              {t(locale, "experience.filtered_by", { label: evidence.filter })}
            </p>
          ) : null}
          {evidence.showAsQloo ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-muted">
              <dt className="break-words">{t(locale, "experience.matched_tags")}</dt>
              <dd className="min-w-0 break-words">
                {details.showMatchedNone
                  ? t(locale, "experience.matched_tags_none")
                  : details.matchedTags.join(", ")}
              </dd>
              {details.rank !== null ? (
                <>
                  <dt className="break-words">{t(locale, "experience.rank")}</dt>
                  <dd className="tabular-nums">{details.rank}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {evidence.showAsQloo ? (
            <p className="text-ink-muted break-words">
              {t(
                locale,
                evidence.filter ? "experience.ranked_for_filter" : "experience.ranked_for_signals",
                { rank: evidence.rank, total: evidence.totalResults }
              )}
            </p>
          ) : null}
          <p className="text-ink-muted break-words">
            {t(locale, "experience.source")}: {sourceLabel}
          </p>
          <p className="text-ink-faint text-xs break-words">
            {t(locale, "experience.queried_at")}: {new Date(evidence.queriedAt).toLocaleString()}
          </p>
        </section>

        <section className="min-w-0 space-y-2 text-sm">
          <h3 className="font-semibold">{t(locale, "experience.from_voluntrip")}</h3>
          <p className="text-ink-muted break-words">
            {t(locale, "experience.value_score_detail", { score: details.valueScore })}
          </p>
          <p className="text-ink-muted break-words">
            {t(locale, "experience.estimated", {
              cost: formatMoney(experience.estimatedCost.amount, "USD", { showCode: true }),
            })}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-muted">
            <dt className="break-words">{t(locale, "experience.daily_before")}</dt>
            <dd className="tabular-nums">
              {formatMoney(experience.whyVoluntrip.dailySafeSpendBefore, "USD")}
            </dd>
            <dt className="break-words">{t(locale, "experience.daily_after")}</dt>
            <dd className="tabular-nums">
              {formatMoney(experience.whyVoluntrip.dailySafeSpendAfter, "USD")}
            </dd>
            <dt className="break-words">{t(locale, "experience.protected")}</dt>
            <dd>
              {experience.whyVoluntrip.protectedMoneyUntouched
                ? t(locale, "navi.experience.protected_yes")
                : t(locale, "navi.experience.protected_no")}
            </dd>
            <dt className="break-words">{t(locale, "experience.runway")}</dt>
            <dd className="min-w-0 break-words">
              {spendingStatusLabel(locale, experience.whyVoluntrip.runwayStatus)}
            </dd>
          </dl>
        </section>

        {alternative ? (
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t(locale, "tonight.alternative")}
            </p>
            <ExperienceCard experience={alternative} />
          </div>
        ) : null}

        <Button
          className="min-h-10 w-full min-w-0 max-w-full"
          onClick={() => onSimulate(experience.estimatedCost.amount)}
        >
          {t(locale, "tonight.go")}
        </Button>
      </div>
    </BottomSheet>
  );
}
