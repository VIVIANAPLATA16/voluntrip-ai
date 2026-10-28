import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { AIInsight } from "@/types";

const CITY_DEMO_INSIGHTS: Record<
  string,
  { titleKey: "demo.insight.singapore_title" | "demo.insight.medellin_title" }
> = {
  "insight-sg-1": { titleKey: "demo.insight.singapore_title" },
  "insight-med-1": { titleKey: "demo.insight.medellin_title" },
};

/** Localize canned demo insights at render time. IndexedDB keeps the English original. */
export function localizedDemoInsight(
  insight: AIInsight,
  locale: Locale,
  available: number,
  days: number
): AIInsight {
  const city = CITY_DEMO_INSIGHTS[insight.id];
  if (city) {
    return {
      ...insight,
      title: t(locale, city.titleKey),
      message: t(locale, "demo.insight.body", { available, days }),
    };
  }
  if (insight.id === "insight-1") {
    return {
      ...insight,
      title: t(locale, "demo.insight.chiang_title"),
      message: t(locale, "demo.insight.chiang_body"),
    };
  }
  return insight;
}
