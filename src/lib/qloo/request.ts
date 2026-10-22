import {
  QLOO_ENTITY_UUID,
  QLOO_MAX_CITY_LENGTH,
  QLOO_MAX_ENTITIES,
  QLOO_MAX_ENTITY_QUERY,
  QLOO_MAX_FILTER_TAGS,
  QLOO_MAX_TAGS,
  QLOO_MAX_TAKE,
  QLOO_MIN_TAKE,
  QLOO_TAG_URN,
  type QlooEntitySearchQuery,
  type QlooPlaceQuery,
} from "./types";

const ALLOWED_FIELDS = new Set(["city", "tags", "take", "filterTags", "entities"]);
const ENTITY_SEARCH_FIELDS = new Set(["query", "take"]);

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

  let filterTags: string[] | undefined;
  if (body.filterTags !== undefined) {
    if (!Array.isArray(body.filterTags) || body.filterTags.length > QLOO_MAX_FILTER_TAGS) {
      return { ok: false, error: `filterTags must be an array of at most ${QLOO_MAX_FILTER_TAGS} string.` };
    }
    filterTags = [];
    for (const tag of body.filterTags) {
      if (typeof tag !== "string" || !QLOO_TAG_URN.test(tag)) {
        return { ok: false, error: "Each filterTags value must match urn:tag:…" };
      }
      filterTags.push(tag);
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

  let entities: string[] | undefined;
  if (body.entities !== undefined) {
    if (!Array.isArray(body.entities) || body.entities.length > QLOO_MAX_ENTITIES) {
      return {
        ok: false,
        error: `entities must be an array of at most ${QLOO_MAX_ENTITIES} UUID strings.`,
      };
    }
    entities = [];
    for (const id of body.entities) {
      if (typeof id !== "string" || !QLOO_ENTITY_UUID.test(id.trim())) {
        return { ok: false, error: "Each entity id must be a UUID." };
      }
      entities.push(id.trim().toLowerCase());
    }
  }

  const query: QlooPlaceQuery = { city };
  if (tags) query.tags = tags;
  if (filterTags) query.filterTags = filterTags;
  if (entities && entities.length > 0) query.entities = entities;
  if (take !== undefined) query.take = take;
  return { ok: true, query };
}

export type QlooEntitySearchValidation =
  | { ok: true; query: QlooEntitySearchQuery }
  | { ok: false; error: string };

export function validateQlooEntitySearchRequest(body: unknown): QlooEntitySearchValidation {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const extra = Object.keys(body).filter((key) => !ENTITY_SEARCH_FIELDS.has(key));
  if (extra.length > 0) {
    return { ok: false, error: "Unexpected fields are not allowed." };
  }

  if (typeof body.query !== "string") {
    return { ok: false, error: "query must be a string." };
  }
  const query = body.query.trim();
  if (!query) {
    return { ok: false, error: "query is required." };
  }
  if (query.length > QLOO_MAX_ENTITY_QUERY) {
    return { ok: false, error: `query must be at most ${QLOO_MAX_ENTITY_QUERY} characters.` };
  }

  let take: number | undefined;
  if (body.take !== undefined) {
    if (typeof body.take !== "number" || !Number.isInteger(body.take)) {
      return { ok: false, error: "take must be an integer." };
    }
    if (body.take < QLOO_MIN_TAKE || body.take > QLOO_MAX_ENTITIES) {
      return { ok: false, error: `take must be between ${QLOO_MIN_TAKE} and ${QLOO_MAX_ENTITIES}.` };
    }
    take = body.take;
  }

  return { ok: true, query: take !== undefined ? { query, take } : { query } };
}
