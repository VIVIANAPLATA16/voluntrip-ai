"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";

export default function HomePage() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const profile = useAppStore((s) => s.profile);
  const router = useRouter();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(profile?.onboardingComplete ? "/app" : "/onboarding");
  }, [hydrated, profile, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="h-12 w-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
