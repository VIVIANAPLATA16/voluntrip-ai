"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/constants";
import type { Experience } from "@/lib/experiences";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";

export function ExperienceCard({
  experience,
  provenanceLabel,
}: {
  experience: Experience;
  provenanceLabel?: string;
}) {
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const source = experience.whyQloo.source;
  const sourceKey =
    source === "qloo"
      ? "experience.source_qloo"
      : source === "demo"
        ? "experience.source_demo"
        : "experience.source_unavailable";

  return (
    <Card padding="sm" className="min-w-0 max-w-full space-y-3 overflow-hidden">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink break-words">
            {experience.name}
          </p>
          {experience.neighborhood ? (
            <p className="mt-0.5 text-xs text-ink-muted break-words">{experience.neighborhood}</p>
          ) : null}
        </div>
        <Badge variant={source === "qloo" ? "accent" : source === "demo" ? "warning" : "danger"}>
          {t(locale, sourceKey)}
        </Badge>
      </div>

      <p className="text-sm text-ink break-words">
        {t(locale, "experience.estimated", {
          cost: formatMoney(experience.estimatedCost.amount, "USD", { showCode: true }),
        })}
      </p>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="min-w-0">
          <dt className="text-ink-faint break-words">{t(locale, "experience.cultural_fit")}</dt>
          <dd className="mt-1 font-semibold tabular-nums">{experience.culturalFit}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-faint break-words">{t(locale, "experience.financial_fit")}</dt>
          <dd className="mt-1 font-semibold tabular-nums">{experience.financialFit}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-faint break-words">{t(locale, "experience.value_score")}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-accent">{experience.valueScore}</dd>
        </div>
      </dl>

      {provenanceLabel ? (
        <p className="text-xs text-ink-faint break-words">{provenanceLabel}</p>
      ) : null}
    </Card>
  );
}
