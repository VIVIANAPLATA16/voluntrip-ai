import { NextResponse } from "next/server";
import type { Locale } from "@/lib/i18n/dictionaries";
import {
  isSpeechConfigured,
  resolveAudioContentType,
  transcribeAudio,
} from "@/lib/ai/azureSpeech.server";

/**
 * POST /api/navi/speech
 * multipart/form-data: audio (Blob/File), locale (en|es|pt), optional contentType
 * → { text: string }
 */
export async function POST(request: Request) {
  try {
    if (!isSpeechConfigured()) {
      return NextResponse.json(
        { error: "Azure Speech is not configured" },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const audio = form.get("audio");
    const locale = (String(form.get("locale") || "en") as Locale) || "en";
    const declaredFromField = String(form.get("contentType") || "").trim();

    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }

    const buffer = await audio.arrayBuffer();
    // Prefer explicit field, then File/Blob type. Never default to webm —
    // iOS sends MP4 and a wrong type causes consistent NoMatch.
    const declared = declaredFromField || audio.type || "";
    const contentType = resolveAudioContentType(buffer, declared);

    try {
      const text = await transcribeAudio(buffer, contentType, locale);
      return NextResponse.json({ text });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Speech failed";
      if (message === "NO_SPEECH" || message === "Empty transcription" || message === "Empty audio") {
        return NextResponse.json({ error: "NO_SPEECH" }, { status: 422 });
      }
      return NextResponse.json({ error: message }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech request failed" },
      { status: 500 }
    );
  }
}
