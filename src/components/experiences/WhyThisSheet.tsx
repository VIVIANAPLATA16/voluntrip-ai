"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/constants";
import { GENERIC_BASELINE_LABEL } from "@/lib/experiences";
import type { Experience } from "@/lib/experiences";
import { t } from "@/lib/i18n/dictionaries";
import { spendingStatusLabel } from "@/lib/i18n/labels";
import { useAppStore } from "@/store/appStore";
import { ExperienceCard } from "./ExperienceCard";

export function WhyThisSheet({
  open,
  onClose,
  experience,
  alternative,
  usedBaseline,
  onSimulate,
}: {
  open: boolean;
  onClose: () => void;
  experience: Experience | null;
  alternative: Experience | null;
  usedBaseline?: boolean;
  onSimulate: (amount: number) => void;
}) {
  const locale = useAppStore((s) => s.locale);
  if (!experience) return null;

  const tags =
    experience.whyQloo.matchedTags.length > 0
      ? experience.whyQloo.matchedTags.join(", ")
      : t(locale, "navi.experience.no_matched_tags");
  const queried = new Date(experience.whyQloo.queriedAt).toLocaleString(
    locale === "es" ? "es-CO" : locale === "pt" ? "pt-BR" : "en-US",
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(locale, "tonight.why")}
      className="min-w-0 max-w-[360px] md:max-w-lg"
    >
      <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
        <ExperienceCard
          experience={experience}
          provenanceLabel={usedBaseline ? GENERIC_BASELINE_LABEL : undefined}
        />

        <section className="min-w-0 space-y-1 rounded-2xl border border-border bg-surface/70 p-3">
          <h3 className="text-sm font-semibold break-words">{t(locale, "experience.from_qloo")}</h3>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.matched_tags")}: {tags}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.rank")}: {experience.whyQloo.rank}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.source")}: {experience.whyQloo.source}
            {usedBaseline ? ` (${GENERIC_BASELINE_LABEL})` : ""}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.queried_at")}: {queried}
          </p>
        </section>

        <section className="min-w-0 space-y-1 rounded-2xl border border-border bg-surface/70 p-3">
          <h3 className="text-sm font-semibold break-words">
            {t(locale, "experience.from_voluntrip")}
          </h3>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.estimated", {
              cost: formatMoney(experience.estimatedCost.amount, "USD", { showCode: true }),
            })}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.daily_before")}:{" "}
            {formatMoney(experience.whyVoluntrip.dailySafeSpendBefore, "USD")}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.daily_after")}:{" "}
            {formatMoney(experience.whyVoluntrip.dailySafeSpendAfter, "USD")}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.protected")}:{" "}
            {experience.whyVoluntrip.protectedMoneyUntouched
              ? t(locale, "navi.experience.protected_yes")
              : t(locale, "navi.experience.protected_no")}
          </p>
          <p className="text-xs text-ink-muted break-words">
            {t(locale, "experience.runway")}:{" "}
            {spendingStatusLabel(locale, experience.whyVoluntrip.runwayStatus)}
          </p>
        </section>

        {alternative ? (
          <section className="min-w-0 space-y-2">
            <p className="text-xs font-semibold text-ink-faint break-words">
              {t(locale, "tonight.alternative")}
            </p>
            <ExperienceCard experience={alternative} />
          </section>
        ) : null}

        <Button
          className="w-full max-w-full"
          onClick={() => onSimulate(experience.estimatedCost.amount)}
        >
          {t(locale, "tonight.go")}
        </Button>
      </div>
    </BottomSheet>
  );
}
