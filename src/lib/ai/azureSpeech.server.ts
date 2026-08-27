/**
 * Azure Speech-to-Text — SERVER ONLY.
 * Import exclusively from Route Handlers (e.g. src/app/api/navi/speech/route.ts).
 *
 * Uses the conversation STT REST endpoint. Browser MediaRecorder typically sends
 * WebM/Opus (Chrome) or MP4 (Safari); Azure accepts WebM, OGG/Opus, WAV, MP3, etc.
 * No client-side WAV conversion required when Content-Type matches the blob.
 */

import type { Locale } from "@/lib/i18n/dictionaries";

export interface AzureSpeechConfig {
  key: string;
  region: string;
}

/** Map app locale → Azure Speech locale code. */
export function speechLocaleFromApp(locale: Locale | string): string {
  switch (locale) {
    case "es":
      return "es-ES";
    case "pt":
      return "pt-BR";
    case "en":
    default:
      return "en-US";
  }
}

export function getSpeechConfig(): AzureSpeechConfig | null {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) return null;
  return { key, region };
}

export function isSpeechConfigured(): boolean {
  return getSpeechConfig() !== null;
}

interface SpeechRecognitionResponse {
  RecognitionStatus?: string;
  DisplayText?: string;
  Offset?: number;
  Duration?: number;
}

/**
 * Transcribe raw audio bytes via Azure Speech REST.
 * @param audio - PCM/WAV/WebM/OGG/MP3 bytes from the client
 * @param contentType - e.g. "audio/webm;codecs=opus"
 * @param locale - app locale (en|es|pt)
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  contentType: string,
  locale: Locale | string = "en"
): Promise<string> {
  const config = getSpeechConfig();
  if (!config) {
    throw new Error("Azure Speech is not configured");
  }

  if (!audio.byteLength) {
    throw new Error("Empty audio");
  }

  const language = speechLocaleFromApp(locale);
  const url =
    `https://${config.region}.stt.speech.microsoft.com` +
    `/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Content-Type": contentType || "audio/webm",
      Accept: "application/json",
    },
    body: audio,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Azure Speech failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  const data = (await res.json()) as SpeechRecognitionResponse;
  const status = data.RecognitionStatus || "";

  if (status === "Success") {
    const text = (data.DisplayText || "").trim();
    if (!text) throw new Error("Empty transcription");
    return text;
  }

  if (
    status === "NoMatch" ||
    status === "InitialSilenceTimeout" ||
    status === "BabbleTimeout"
  ) {
    throw new Error("NO_SPEECH");
  }

  throw new Error(`Azure Speech status: ${status || "unknown"}`);
}
