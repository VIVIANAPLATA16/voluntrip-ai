import { NextResponse } from "next/server";
import {
  MAX_GROUP_BODY_BYTES,
  type GroupErrStatus,
  type GroupResult,
  type GroupStatus,
} from "./types";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;

const joinAttempts = new Map<string, number[]>();
const readAttempts = new Map<string, number[]>();

export function resetGroupRateLimits() {
  joinAttempts.clear();
  readAttempts.clear();
}

export function groupClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export function allowGroupAttempt(kind: "join" | "read", ip: string): boolean {
  const map = kind === "join" ? joinAttempts : readAttempts;
  const now = Date.now();
  const prev = (map.get(ip) ?? []).filter(function (stamp) {
    return now - stamp < RATE_WINDOW_MS;
  });
  if (prev.length >= RATE_MAX) {
    map.set(ip, prev);
    return false;
  }
  prev.push(now);
  map.set(ip, prev);
  return true;
}

export async function readGroupJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; status: GroupErrStatus }> {
  const raw = await request.text();
  if (raw.length > MAX_GROUP_BODY_BYTES) return { ok: false, status: "too_large" };
  if (!raw.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: "extra_fields" };
  }
}

const HTTP_BY_STATUS: Partial<Record<GroupStatus, number>> = {
  ok: 200,
  unavailable: 503,
  invalid_code: 400,
  invalid_alias: 400,
  invalid_tags: 400,
  invalid_entities: 400,
  invalid_secret: 400,
  extra_fields: 400,
  too_large: 413,
  alias_taken: 409,
  group_full: 409,
  not_found: 404,
  unauthorized: 401,
  no_consent: 403,
  rate_limited: 429,
  code_taken: 503,
};

export function groupJson(
  result: GroupResult | { status: GroupStatus }
): NextResponse {
  const status = HTTP_BY_STATUS[result.status] ?? 400;
  return NextResponse.json(result, { status });
}
