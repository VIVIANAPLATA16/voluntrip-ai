import { NextResponse } from "next/server";
import { searchQlooPlaces } from "@/lib/qloo/client";
import { validateQlooPlaceRequest } from "@/lib/qloo/request";

/**
 * POST /api/qloo
 * JSON: { city: string, tags?: string[], take?: number }
 * → QlooResult ({ source: "qloo" | "demo" | "unavailable" })
 *
 * Server-only Qloo proxy. Never returns the API key.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validateQlooPlaceRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await searchQlooPlaces(parsed.query);
  return NextResponse.json(result);
}
