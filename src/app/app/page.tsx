"use client";

import { HomeDashboard } from "@/components/home/HomeDashboard";
import { useAppStore } from "@/store/appStore";

export default function AppHomePage() {
  const trip = useAppStore((s) => s.trip);

  if (!trip) {
    return (
      <div className="py-20 text-center text-ink-muted text-sm">
        No trip yet. Complete onboarding or load the demo.
      </div>
    );
  }

  return <HomeDashboard />;
}
