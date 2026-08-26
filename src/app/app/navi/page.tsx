"use client";

import { NaviPanel } from "@/components/navi/NaviPanel";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";

export default function NaviPage() {
  const locale = useAppStore((s) => s.locale);
  return (
    <div className="w-full min-w-0 space-y-2">
      <h1 className="font-display text-2xl font-semibold sr-only md:not-sr-only md:mb-4">
        {t(locale, "nav.navi")}
      </h1>
      <NaviPanel />
    </div>
  );
}
