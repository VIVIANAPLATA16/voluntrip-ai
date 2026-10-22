import type { QlooEntitiesResult, QlooPlaceQuery, QlooResult } from "./types";

/**
 * Browser-safe Qloo lookup. Posts to `/api/qloo` so the API key never
 * leaves the server. Do not import `./client` from client bundles.
 */
export async function fetchQlooPlaces(query: QlooPlaceQuery): Promise<QlooResult> {
  try {
    const body: {
      city: string;
      tags?: string[];
      filterTags?: string[];
      entities?: string[];
      take: number;
    } = {
      city: query.city,
      take: query.take ?? 10,
    };
    if (query.tags && query.tags.length > 0) body.tags = query.tags;
    if (query.filterTags && query.filterTags.length > 0) body.filterTags = query.filterTags;
    if (query.entities && query.entities.length > 0) body.entities = query.entities;

    const res = await fetch("/api/qloo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload: unknown = await res.json().catch(() => null);
    if (isQlooResult(payload)) return payload;
    return { source: "unavailable", places: [], reason: "QLOO_BAD_RESPONSE" };
  } catch {
    return { source: "unavailable", places: [], reason: "QLOO_NETWORK" };
  }
}

export async function fetchQlooEntities(query: string): Promise<QlooEntitiesResult> {
  try {
    const res = await fetch("/api/qloo/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, take: 5 }),
    });
    const payload: unknown = await res.json().catch(() => null);
    if (isQlooEntitiesResult(payload)) return payload;
    return { source: "unavailable", entities: [], reason: "QLOO_BAD_RESPONSE" };
  } catch {
    return { source: "unavailable", entities: [], reason: "QLOO_NETWORK" };
  }
}

function isQlooEntitiesResult(value: unknown): value is QlooEntitiesResult {
  if (!value || typeof value !== "object") return false;
  const record = value as { source?: unknown; entities?: unknown; reason?: unknown };
  if (record.source === "qloo" && Array.isArray(record.entities)) return true;
  if (record.source === "demo" && Array.isArray(record.entities) && record.reason === "NO_KEY") {
    return true;
  }
  if (record.source === "unavailable" && Array.isArray(record.entities)) return true;
  return false;
}

function isQlooResult(value: unknown): value is QlooResult {
  if (!value || typeof value !== "object") return false;
  const record = value as { source?: unknown; places?: unknown; reason?: unknown };
  if (record.source === "qloo" && Array.isArray(record.places)) {
    return true;
  }
  if (record.source === "demo" && Array.isArray(record.places) && record.reason === "NO_KEY") {
    return true;
  }
  if (record.source === "unavailable" && Array.isArray(record.places)) {
    return true;
  }
  return false;
}
