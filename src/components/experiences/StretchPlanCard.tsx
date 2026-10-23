"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { whatIfSpendText } from "@/lib/agent/purchaseLabel";
import { STRETCH_NIGHT_OPTIONS, type StretchNights } from "@/lib/experiences";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";
import { StretchPlanSheet } from "./StretchPlanSheet";

export function StretchPlanCard() {
  const router = useRouter();
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const trip = useAppStore(function (s) {
    return s.trip;
  });
  const askNavi = useAppStore(function (s) {
    return s.askNavi;
  });
  const [nights, setNights] = useState(3 as StretchNights);
  const [open, setOpen] = useState(false);

  if (!trip) return null;

  async function simulateEstimated(amount: number, placeLabel?: string | null) {
    setOpen(false);
    await askNavi(whatIfSpendText(amount, placeLabel));
    router.push("/app/navi");
  }

  return (
    <section className="min-w-0 max-w-full space-y-3">
      <Card className="min-w-0 max-w-full space-y-3 overflow-hidden">
        <h2 className="text-sm font-semibold text-ink break-words">{t(locale, "stretch.title")}</h2>
        <div className="flex min-w-0 flex-wrap gap-2">
          {STRETCH_NIGHT_OPTIONS.map(function (option) {
            return (
              <Button
                key={option}
                size="sm"
                variant={nights === option ? "primary" : "secondary"}
                className="h-auto min-h-10 min-w-10"
                onClick={function () {
                  setNights(option);
                }}
              >
                {t(locale, "stretch.nights", { count: option })}
              </Button>
            );
          })}
        </div>
        <Button
          size="sm"
          className="h-auto min-h-10 min-w-0 max-w-full whitespace-normal"
          onClick={function () {
            setOpen(true);
          }}
        >
          {t(locale, "stretch.build")}
        </Button>
      </Card>
      <StretchPlanSheet
        open={open}
        nights={nights}
        onClose={function () {
          setOpen(false);
        }}
        onSimulate={function (amount, placeLabel) {
          void simulateEstimated(amount, placeLabel);
        }}
      />
    </section>
  );
}
