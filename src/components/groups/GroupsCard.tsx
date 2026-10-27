"use client";

import Link from "next/link";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";

export function GroupsCard() {
  const locale = useAppStore(function (s) {
    return s.locale;
  });

  return (
    <section className="min-w-0 max-w-full overflow-x-hidden rounded-card border border-border bg-surface/80 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-ink break-words">
        {t(locale, "groups.title")}
      </h2>
      <p className="text-sm text-ink-muted break-words">{t(locale, "groups.card_body")}</p>
      <Link
        href="/app/groups"
        className="inline-flex min-h-10 h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-bg touch-target break-words motion-reduce:transition-none"
      >
        {t(locale, "groups.card_open")}
      </Link>
    </section>
  );
}
