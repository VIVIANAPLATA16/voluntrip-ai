"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { NavigationBar } from "@/components/ui/NavigationBar";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { t } from "@/lib/i18n/dictionaries";
import { useRouter, usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const profile = useAppStore((s) => s.profile);
  const locale = useAppStore((s) => s.locale);
  const setOffline = useAppStore((s) => s.setOffline);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOffline]);

  useEffect(() => {
    if (!hydrated) return;
    if (pathname.startsWith("/onboarding")) return;
    if (profile?.onboardingComplete) return;

    // Magic-link return: stay on /app/trip while exchanging code / syncing
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("code") || params.get("sync") === "1") return;
    }

    router.replace("/onboarding");
  }, [hydrated, profile, pathname, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore in dev */
      });
    }
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <DesktopSidebar locale={locale} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-3xl lg:max-w-5xl mx-auto px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8 md:pt-6">
          {children}
        </main>
        <NavigationBar locale={locale} />
        <InstallPrompt />
      </div>
      {/* Desktop NAVI rail hint on large screens for home */}
      <aside className="hidden xl:flex w-80 shrink-0 border-l border-border p-5 sticky top-0 h-screen overflow-y-auto bg-bg-elevated/40">
        <div className="w-full text-sm text-ink-muted">
          <p className="font-display text-ink font-semibold mb-2">
            {t(locale, "layout.navi_tip_title")}
          </p>
          <p>{t(locale, "layout.navi_tip_body")}</p>
        </div>
      </aside>
    </div>
  );
}
