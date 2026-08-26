import type { HostBenefit, MoneyRunwayResult, Pocket, PocketCategory } from "@/types";
import { t, type Locale, type TranslationKey } from "./dictionaries";

const BENEFIT_KEYS: Record<HostBenefit, TranslationKey> = {
  accommodation: "benefit.accommodation",
  breakfast: "benefit.breakfast",
  lunch: "benefit.lunch",
  dinner: "benefit.dinner",
  laundry: "benefit.laundry",
  transport: "benefit.transport",
  tours: "benefit.tours",
};

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  food: "category.food",
  transport: "category.transport",
  fun: "category.fun",
  general: "category.general",
};

const POCKET_NAME_KEYS: Record<string, TranslationKey> = {
  Food: "pocket.food",
  Transport: "pocket.transport",
  Fun: "pocket.fun",
  Emergency: "pocket.emergency",
  "Return Flight": "pocket.return_flight",
};

export function benefitLabel(locale: Locale, benefit: HostBenefit): string {
  return t(locale, BENEFIT_KEYS[benefit]);
}

export function categoryLabel(locale: Locale, category: string): string {
  const key = CATEGORY_KEYS[category];
  return key ? t(locale, key) : category;
}

export function pocketDisplayName(locale: Locale, pocket: Pocket): string {
  const byName = POCKET_NAME_KEYS[pocket.name];
  if (byName) return t(locale, byName);
  const byCategory = CATEGORY_KEYS[pocket.category as PocketCategory];
  if (byCategory && ["food", "transport", "fun"].includes(pocket.category)) {
    return t(locale, byCategory);
  }
  return pocket.name;
}

export function spendingStatusLabel(locale: Locale, status: string): string {
  if (status === "careful") return t(locale, "status.careful");
  if (status === "at_risk") return t(locale, "status.at_risk");
  return t(locale, "status.on_track");
}

export function formatRunwayMessage(locale: Locale, runway: MoneyRunwayResult): string {
  const dateLocale = locale === "es" ? "es-ES" : locale === "pt" ? "pt-BR" : "en-US";
  if (runway.status === "on_track" || runway.daysEarly <= 0) {
    const date = new Date(runway.tripEndDate).toLocaleDateString(dateLocale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return t(locale, "navi.runway_on_track", { date });
  }
  if (runway.status === "careful") {
    return t(locale, "navi.runway_careful", { daysEarly: runway.daysEarly });
  }
  const date = new Date(runway.runwayDate).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return t(locale, "navi.runway_at_risk", { daysEarly: runway.daysEarly, date });
}

export function destinationTabLabel(locale: Locale, tabId: string): string {
  const keys: Record<string, TranslationKey> = {
    popular: "tab.popular",
    americas: "tab.americas",
    europe: "tab.europe",
    "asia-oceania": "tab.asia_oceania",
    "africa-me": "tab.africa_me",
  };
  const key = keys[tabId];
  return key ? t(locale, key) : tabId;
}

/** Mock voice/receipt concept labels (system categories, not user data). */
export function mockConceptLabel(locale: Locale, concept: string): string {
  const map: Record<string, TranslationKey> = {
    Dinner: "navi.mock_dinner",
    Transport: "category.transport",
    "Local Market": "navi.mock_merchant",
  };
  const key = map[concept];
  return key ? t(locale, key) : concept;
}
