import type { QlooPlace, QlooTag } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePriceLevel(value: unknown): 1 | 2 | 3 | 4 | null {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return null;
}

function normalizeTags(raw: unknown): QlooPlace["tags"] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];

  const tags: QlooPlace["tags"] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asNonEmptyString(item.id) ?? asNonEmptyString(item.tag_id);
    const name = asNonEmptyString(item.name);
    const type = asNonEmptyString(item.type) ?? "";
    if (id && name) tags.push({ id, name, type });
  }
  return tags;
}

function normalizeEntity(raw: unknown, rank: number): QlooPlace | null {
  if (!isRecord(raw)) return null;
  const id = asNonEmptyString(raw.entity_id);
  const name = asNonEmptyString(raw.name);
  if (!id || !name) return null;

  const properties = isRecord(raw.properties) ? raw.properties : {};
  const location = isRecord(raw.location) ? raw.location : {};

  const neighborhood =
    asNonEmptyString(properties.neighborhood) ?? asNonEmptyString(location.neighborhood);
  const address = asNonEmptyString(properties.address) ?? asNonEmptyString(location.address);

  return {
    id,
    name,
    tags: normalizeTags(raw.tags),
    popularity: asFiniteNumber(raw.popularity),
    priceLevel: normalizePriceLevel(properties.price_level),
    rank,
    ...(neighborhood ? { neighborhood } : {}),
    ...(address ? { address } : {}),
  };
}

/**
 * Map a Qloo Insights payload to places. Returns null when the payload is not
 * a successful, expected shape — callers must then use `unavailable`, never
 * invent entities.
 */
export function normalizeInsightsResponse(payload: unknown): QlooPlace[] | null {
  if (!isRecord(payload)) return null;
  if (payload.success !== true) return null;
  const results = payload.results;
  if (!isRecord(results) || !Array.isArray(results.entities)) return null;

  const places: QlooPlace[] = [];
  for (let i = 0; i < results.entities.length; i++) {
    const place = normalizeEntity(results.entities[i], i + 1);
    if (place) places.push(place);
  }
  return places;
}

export function normalizeTagsResponse(payload: unknown): QlooTag[] | null {
  if (!isRecord(payload)) return null;
  if (payload.success !== true) return null;
  const results = payload.results;
  if (!isRecord(results) || !Array.isArray(results.tags)) return null;

  const tags: QlooTag[] = [];
  for (const item of results.tags) {
    if (!isRecord(item)) continue;
    const id = asNonEmptyString(item.id) ?? asNonEmptyString(item.tag_id);
    const name = asNonEmptyString(item.name);
    const type =
      asNonEmptyString(item.type) ??
      (Array.isArray(item.types) ? asNonEmptyString(item.types[0]) : undefined) ??
      "";
    if (id && name) tags.push({ id, name, type });
  }
  return tags;
}
