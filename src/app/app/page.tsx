"use client";

import { HomeDashboard } from "@/components/home/HomeDashboard";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";

export default function AppHomePage() {
  const locale = useAppStore((s) => s.locale);
  const trip = useAppStore((s) => s.trip);

  if (!trip) {
    return (
      <div className="py-20 text-center text-ink-muted text-sm">
        {t(locale, "home.no_trip_yet")}
      </div>
    );
  }

  return <HomeDashboard />;
}
