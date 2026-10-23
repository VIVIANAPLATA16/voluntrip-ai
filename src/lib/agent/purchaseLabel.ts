import { formatMoney } from "@/lib/constants";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import type { CurrencyCode, PurchaseSimulation, Trip } from "@/types";

/** Current Activity label when the traveler did not name a place. */
export const GENERIC_PURCHASE_LABEL = "Purchase";

export const PLACE_LABEL_MAX = 80;

/**
 * Strip markup and trim to a short Activity / NAVI label.
 * Returns null instead of inventing a name.
 */
export function sanitizePlaceLabel(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const stripped = String(raw)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;
  if (stripped.length <= PLACE_LABEL_MAX) return stripped;
  return stripped.slice(0, PLACE_LABEL_MAX).trimEnd();
}

export function formatExperiencePlaceLabel(place: {
  name: string;
  neighborhood?: string;
}): string | null {
  const name = sanitizePlaceLabel(place.name);
  if (!name) return null;
  const hood = sanitizePlaceLabel(place.neighborhood);
  if (!hood) return name;
  return sanitizePlaceLabel(`${name} - ${hood}`);
}

export function whatIfSpendText(amount: number, placeLabel?: string | null): string {
  const dollars = Math.round(amount);
  const place = sanitizePlaceLabel(placeLabel ?? undefined);
  if (!place) return `What if I spend $${dollars}?`;
  return `What if I spend $${dollars} at ${place}?`;
}

export function extractPlaceFromWhatIf(text: string): string | null {
  const match = text.match(
    /what if i (?:spend|buy|book)\s+\$?\s*[\d,.]+(?:\s*(?:usd|dollars?))?\s+at\s+(.+)$/i
  );
  if (!match) return null;
  return sanitizePlaceLabel(match[1].replace(/[?!.]+$/g, ""));
}

export function purchaseConceptFromUserText(text: string): string {
  return extractPlaceFromWhatIf(text) ?? GENERIC_PURCHASE_LABEL;
}

export function confirmedPurchaseInput(
  simulation: Pick<PurchaseSimulation, "purchaseAmount" | "purchaseCurrency">,
  trip: Pick<Trip, "id" | "baseCurrency">,
  userText: string
): {
  tripId: string;
  amountOriginal: number;
  currencyOriginal: CurrencyCode;
  currencyBase: CurrencyCode;
  concept: string;
  category: "general";
  source: "text";
} {
  return {
    tripId: trip.id,
    amountOriginal: simulation.purchaseAmount,
    currencyOriginal: simulation.purchaseCurrency,
    currencyBase: trip.baseCurrency,
    concept: purchaseConceptFromUserText(userText),
    category: "general",
    source: "text",
  };
}

export function formatConfirmedPurchaseMessage(
  locale: Locale,
  simulation: Pick<PurchaseSimulation, "purchaseAmount" | "purchaseCurrency">,
  concept: string
): string | null {
  if (concept === GENERIC_PURCHASE_LABEL) return null;
  return t(locale, "navi.purchase_confirmed", {
    amount: formatMoney(simulation.purchaseAmount, simulation.purchaseCurrency, {
      showCode: true,
    }),
    place: concept,
  });
}
