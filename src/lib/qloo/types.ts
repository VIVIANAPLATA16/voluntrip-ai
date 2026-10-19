/** Normalized place from Qloo Insights or the labeled demo fixture. */
export interface QlooPlace {
  id: string;
  name: string;
  tags: Array<{ id: string; name: string; type: string }>;
  popularity: number | null;
  priceLevel: 1 | 2 | 3 | 4 | null;
  rank: number;
  neighborhood?: string;
  address?: string;
}

export type QlooUnavailableReason =
  | "NO_KEY"
  | "QLOO_AUTH"
  | "QLOO_RATE_LIMIT"
  | "QLOO_TIMEOUT"
  | "QLOO_BAD_RESPONSE"
  | "QLOO_NETWORK";

/**
 * Discriminated union. `source: "qloo"` is only allowed after a successful
 * HTTP response that normalized cleanly. Demo and unavailable cannot be
 * represented as live Qloo results.
 */
export type QlooResult =
  | {
      source: "qloo";
      places: QlooPlace[];
    }
  | {
      source: "demo";
      places: QlooPlace[];
      reason: "NO_KEY";
    }
  | {
      source: "unavailable";
      places: [];
      reason: QlooUnavailableReason;
    };

export function isLiveQlooResult(
  result: QlooResult
): result is Extract<QlooResult, { source: "qloo" }> {
  return result.source === "qloo";
}

export interface QlooPlaceQuery {
  city: string;
  tags?: string[];
  take?: number;
}

export interface QlooTagQuery {
  query: string;
  take?: number;
}

export interface QlooTag {
  id: string;
  name: string;
  type: string;
}

export type QlooTagsResult =
  | { source: "qloo"; tags: QlooTag[] }
  | { source: "demo"; tags: QlooTag[]; reason: "NO_KEY" }
  | { source: "unavailable"; tags: []; reason: QlooUnavailableReason };

export const QLOO_TAG_URN = /^urn:tag:[a-z0-9_:.-]+$/i;
export const QLOO_DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";
export const QLOO_DEFAULT_TIMEOUT_MS = 8_000;
export const QLOO_MAX_CITY_LENGTH = 80;
export const QLOO_MAX_TAGS = 10;
export const QLOO_MIN_TAKE = 1;
export const QLOO_MAX_TAKE = 10;
