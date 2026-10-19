import {
  QLOO_MAX_CITY_LENGTH,
  QLOO_MAX_TAGS,
  QLOO_MAX_TAKE,
  QLOO_MIN_TAKE,
  QLOO_TAG_URN,
  type QlooPlaceQuery,
} from "./types";

const ALLOWED_FIELDS = new Set(["city", "tags", "take"]);

export type QlooRequestValidation =
  | { ok: true; query: QlooPlaceQuery }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateQlooPlaceRequest(body: unknown): QlooRequestValidation {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const extra = Object.keys(body).filter((key) => !ALLOWED_FIELDS.has(key));
  if (extra.length > 0) {
    return { ok: false, error: "Unexpected fields are not allowed." };
  }

  if (typeof body.city !== "string") {
    return { ok: false, error: "city must be a string." };
  }
  const city = body.city.trim();
  if (!city) {
    return { ok: false, error: "city is required." };
  }
  if (city.length > QLOO_MAX_CITY_LENGTH) {
    return { ok: false, error: `city must be at most ${QLOO_MAX_CITY_LENGTH} characters.` };
  }

  let tags: string[] | undefined;
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > QLOO_MAX_TAGS) {
      return { ok: false, error: `tags must be an array of at most ${QLOO_MAX_TAGS} strings.` };
    }
    tags = [];
    for (const tag of body.tags) {
      if (typeof tag !== "string" || !QLOO_TAG_URN.test(tag)) {
        return { ok: false, error: "Each tag must match urn:tag:…" };
      }
      tags.push(tag);
    }
  }

  let take: number | undefined;
  if (body.take !== undefined) {
    if (typeof body.take !== "number" || !Number.isInteger(body.take)) {
      return { ok: false, error: "take must be an integer." };
    }
    if (body.take < QLOO_MIN_TAKE || body.take > QLOO_MAX_TAKE) {
      return { ok: false, error: `take must be between ${QLOO_MIN_TAKE} and ${QLOO_MAX_TAKE}.` };
    }
    take = body.take;
  }

  return { ok: true, query: { city, tags, take } };
}
