/**
 * Qloo Taste API — SERVER ONLY.
 * Import from Route Handlers. Never from client components or `"use client"` modules.
 * Never log QLOO_API_KEY, request headers, or traveler identity.
 */

import { getDemoPlaces } from "./demo";
import { normalizeInsightsResponse, normalizeTagsResponse } from "./normalize";
import type {
  QlooPlaceQuery,
  QlooResult,
  QlooTagQuery,
  QlooTagsResult,
  QlooUnavailableReason,
} from "./types";
import {
  QLOO_DEFAULT_BASE_URL,
  QLOO_DEFAULT_TIMEOUT_MS,
  QLOO_MAX_TAKE,
  QLOO_MIN_TAKE,
} from "./types";

export interface QlooClientOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function getApiKey(): string | null {
  const key = process.env.QLOO_API_KEY?.trim();
  return key ? key : null;
}

function getBaseUrl(): string {
  const raw = process.env.QLOO_API_BASE_URL?.trim() || QLOO_DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function clampTake(take: number | undefined): number {
  const n = typeof take === "number" && Number.isInteger(take) ? take : 5;
  return Math.min(QLOO_MAX_TAKE, Math.max(QLOO_MIN_TAKE, n));
}

function unavailable(reason: QlooUnavailableReason): Extract<QlooResult, { source: "unavailable" }> {
  return { source: "unavailable", places: [], reason };
}

function tagsUnavailable(
  reason: QlooUnavailableReason
): Extract<QlooTagsResult, { source: "unavailable" }> {
  return { source: "unavailable", tags: [], reason };
}

function reasonFromStatus(status: number): QlooUnavailableReason {
  if (status === 401 || status === 403) return "QLOO_AUTH";
  if (status === 429) return "QLOO_RATE_LIMIT";
  return "QLOO_BAD_RESPONSE";
}

function reasonFromCatch(error: unknown): QlooUnavailableReason {
  if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
    return "QLOO_TIMEOUT";
  }
  return "QLOO_NETWORK";
}

async function qlooGet(
  pathWithQuery: string,
  options: QlooClientOptions
): Promise<{ ok: true; status: number; payload: unknown } | { ok: false; reason: QlooUnavailableReason }> {
  const key = getApiKey();
  if (!key) return { ok: false, reason: "NO_KEY" };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? QLOO_DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const res = await fetchImpl(`${getBaseUrl()}${pathWithQuery}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": key,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, reason: reasonFromStatus(res.status) };
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      return { ok: false, reason: "QLOO_BAD_RESPONSE" };
    }

    return { ok: true, status: res.status, payload };
  } catch (error) {
    return { ok: false, reason: reasonFromCatch(error) };
  } finally {
    clearTimeout(timer);
  }
}

function insightsPath(query: QlooPlaceQuery): string {
  const params = new URLSearchParams();
  params.set("filter.type", "urn:entity:place");
  params.set("filter.location.query", query.city.trim());
  params.set("take", String(clampTake(query.take)));
  const tags = (query.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 0) {
    params.set("signal.interests.tags", tags.join(","));
  }
  const filterTags = (query.filterTags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (filterTags.length > 0) {
    params.set("filter.tags", filterTags[0] ?? "");
  }
  return `/v2/insights?${params.toString()}`;
}

function tagsPath(query: QlooTagQuery): string {
  const params = new URLSearchParams();
  params.set("filter.query", query.query.trim());
  params.set("take", String(clampTake(query.take)));
  return `/v2/tags?${params.toString()}`;
}

export async function searchQlooPlaces(
  query: QlooPlaceQuery,
  options: QlooClientOptions = {}
): Promise<QlooResult> {
  if (!getApiKey()) return getDemoPlaces();

  const result = await qlooGet(insightsPath(query), options);
  if (!result.ok) {
    if (result.reason === "NO_KEY") return getDemoPlaces();
    return unavailable(result.reason);
  }

  const places = normalizeInsightsResponse(result.payload);
  if (places == null) return unavailable("QLOO_BAD_RESPONSE");

  return { source: "qloo", places };
}

export async function searchQlooTags(
  query: QlooTagQuery,
  options: QlooClientOptions = {}
): Promise<QlooTagsResult> {
  if (!getApiKey()) {
    return { source: "demo", tags: [], reason: "NO_KEY" };
  }

  const result = await qlooGet(tagsPath(query), options);
  if (!result.ok) {
    if (result.reason === "NO_KEY") {
      return { source: "demo", tags: [], reason: "NO_KEY" };
    }
    return tagsUnavailable(result.reason);
  }

  const tags = normalizeTagsResponse(result.payload);
  if (tags == null) return tagsUnavailable("QLOO_BAD_RESPONSE");

  return { source: "qloo", tags };
}
