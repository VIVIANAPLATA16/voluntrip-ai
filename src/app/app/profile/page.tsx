"use client";

import { CulturalDnaCard } from "@/components/culture/CulturalDnaCard";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";

export default function TasteProfilePage() {
  const locale = useAppStore(function (s) {
    return s.locale;
  });

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <h1 className="font-display text-2xl font-semibold break-words">
        {t(locale, "profile.taste_title")}
      </h1>
      <CulturalDnaCard />
    </div>
  );
}
