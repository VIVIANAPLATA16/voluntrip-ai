import type { QlooPlace } from "@/lib/qloo/types";

/** USD per person. Bands, not verified menu prices — always an estimate. */
export const PRICE_LEVEL_USD = {
  1: 8,
  2: 20,
  3: 40,
  4: 80,
} as const;

/** Fallback USD per person when `price_level` is null. Easy to retune. */
export const CATEGORY_ESTIMATE_USD = {
  nightlife: 25,
  restaurant: 15,
  cafe: 6,
  park: 5,
  other: 15,
} as const;

export type CostEstimateBasis = "price_level" | "category" | "default";

export type CostCategory = keyof typeof CATEGORY_ESTIMATE_USD;

/**
 * Estimated cost in USD per person.
 * Future UI must always present this as an estimate, never a verified price.
 */
export interface CostEstimate {
  amount: number;
  basis: CostEstimateBasis;
  isEstimate: true;
}

function tagBlob(place: Pick<QlooPlace, "tags">): string {
  return place.tags.map((tag) => `${tag.id} ${tag.name}`).join(" ").toLowerCase();
}

export function inferCostCategory(place: Pick<QlooPlace, "tags">): Exclude<CostCategory, "other"> | null {
  const blob = tagBlob(place);
  if (
    blob.includes("nightlife") ||
    blob.includes(":bar") ||
    /(^|[^a-z])bar([^a-z]|$)/.test(blob)
  ) {
    return "nightlife";
  }
  if (blob.includes("restaurant")) return "restaurant";
  if (blob.includes("cafe") || blob.includes("coffee") || blob.includes("café")) return "cafe";
  if (blob.includes("hiking") || blob.includes("park") || blob.includes("activity")) {
    return "park";
  }
  return null;
}

export function estimateExperienceCost(
  place: Pick<QlooPlace, "priceLevel" | "tags">
): CostEstimate {
  const level = place.priceLevel;
  if (level === 1 || level === 2 || level === 3 || level === 4) {
    return {
      amount: PRICE_LEVEL_USD[level],
      basis: "price_level",
      isEstimate: true,
    };
  }

  const category = inferCostCategory(place);
  if (category) {
    return {
      amount: CATEGORY_ESTIMATE_USD[category],
      basis: "category",
      isEstimate: true,
    };
  }

  return {
    amount: CATEGORY_ESTIMATE_USD.other,
    basis: "default",
    isEstimate: true,
  };
}
