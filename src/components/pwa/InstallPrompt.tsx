"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Download, X } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const locale = useAppStore((s) => s.locale);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !deferred) return null;

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-30 md:left-auto md:right-6 md:w-80">
      <div className="rounded-card border border-border bg-surface-elevated shadow-card p-4 flex items-start gap-3">
        <Download className="h-5 w-5 text-accent shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t(locale, "pwa.install_title")}</p>
          <p className="text-xs text-ink-muted mt-1">{t(locale, "pwa.install_body")}</p>
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={async () => {
              await deferred.prompt();
              setHidden(true);
              setDeferred(null);
            }}
          >
            {t(locale, "pwa.install_button")}
          </Button>
        </div>
        <button
          type="button"
          className="touch-target text-ink-faint"
          aria-label={t(locale, "pwa.dismiss")}
          onClick={() => setHidden(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
