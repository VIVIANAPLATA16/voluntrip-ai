import { NextResponse } from "next/server";
import {
  extractTextFromImage,
  isVisionConfigured,
} from "@/lib/ai/azureVision.server";

/**
 * POST /api/navi/ocr
 * JSON: { imageBase64: string } (raw base64 or data URL)
 * → { text: string }
 *
 * OCR only — expense interpretation stays in /api/navi (Azure OpenAI).
 */
export async function POST(request: Request) {
  try {
    if (!isVisionConfigured()) {
      return NextResponse.json(
        { error: "Azure Vision is not configured" },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { imageBase64?: string };
    const imageBase64 = body.imageBase64?.trim();

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    // ~4MB base64 ceiling — keeps payloads safe for serverless
    if (imageBase64.length > 5_500_000) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    try {
      const text = await extractTextFromImage(imageBase64);
      return NextResponse.json({ text });
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR failed";
      if (message === "NO_TEXT" || message === "Empty image") {
        return NextResponse.json({ error: "NO_TEXT" }, { status: 422 });
      }
      return NextResponse.json({ error: message }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR request failed" },
      { status: 500 }
    );
  }
}
