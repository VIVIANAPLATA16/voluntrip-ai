import { NextResponse } from "next/server";
import { searchQlooEntities } from "@/lib/qloo/client";
import { validateQlooEntitySearchRequest } from "@/lib/qloo/request";

/**
 * POST /api/qloo/entities
 * JSON: { query: string, take?: number }
 * → QlooEntitiesResult ({ source: "qloo" | "demo" | "unavailable", entities: [{ id, name, type }] })
 *
 * Server-only Qloo Entity Search proxy. Never returns the API key or aliases.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validateQlooEntitySearchRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await searchQlooEntities(parsed.query);
  return NextResponse.json(result);
}
