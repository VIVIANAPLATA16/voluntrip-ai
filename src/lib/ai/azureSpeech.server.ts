/**
 * Azure Speech-to-Text — SERVER ONLY.
 * Import exclusively from Route Handlers (e.g. src/app/api/navi/speech/route.ts).
 *
 * Browser formats:
 * - Chrome/Android: typically WebM/Opus
 * - Safari/iOS (and all iPhone browsers via WebKit): typically audio/mp4 (AAC)
 *
 * Content-Type MUST match the actual bytes. A wrong type (e.g. labeling MP4 as
 * WebM) makes Azure return NoMatch → "couldn't understand the audio".
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

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + len));
}

/**
 * Detect container from magic bytes. Source of truth when client mime is wrong/empty.
 */
export function sniffAudioContentType(audio: ArrayBuffer): string | null {
  const bytes = new Uint8Array(audio);
  if (bytes.length < 12) return null;

  // WebM / Matroska EBML
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  // Ogg
  if (readAscii(bytes, 0, 4) === "OggS") {
    return "audio/ogg";
  }
  // WAV
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
    return "audio/wav";
  }
  // MP3 with ID3 tag
  if (readAscii(bytes, 0, 3) === "ID3") {
    return "audio/mpeg";
  }
  // MP3 frame sync
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  // MP4 / M4A / AAC-in-MP4: ....ftyp
  if (readAscii(bytes, 4, 4) === "ftyp") {
    return "audio/mp4";
  }
  // ADTS AAC (raw)
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    return "audio/aac";
  }

  return null;
}

/** Normalize client-declared type and prefer sniffed type when they conflict. */
export function resolveAudioContentType(
  audio: ArrayBuffer,
  declared?: string | null
): string {
  const sniffed = sniffAudioContentType(audio);
  const raw = (declared || "").split(";")[0]?.trim().toLowerCase() || "";

  if (sniffed) {
    // Client said webm but bytes are mp4 (classic iOS bug) → trust bytes
    if (raw && sniffed !== raw && !(raw.startsWith(sniffed) || sniffed.startsWith(raw))) {
      const webmVsMp4 =
        (raw.includes("webm") && sniffed.includes("mp4")) ||
        (raw.includes("mp4") && sniffed.includes("webm")) ||
        (raw.includes("webm") && sniffed.includes("aac"));
      if (webmVsMp4 || !raw || raw === "application/octet-stream") {
        return sniffed;
      }
    }
    if (!raw || raw === "application/octet-stream") return sniffed;
  }

  if (raw === "audio/m4a" || raw === "audio/x-m4a") return "audio/mp4";
  if (raw === "audio/mp3") return "audio/mpeg";
  if (raw === "audio/wave" || raw === "audio/x-wav") return "audio/wav";
  if (raw) return raw;
  return sniffed || "audio/wav";
}

/**
 * Transcribe raw audio bytes via Azure Speech REST.
 * @param audio - WebM/OGG/MP4/AAC/WAV/MP3 bytes from the client
 * @param contentType - declared mime (may be wrong on iOS); sniffed as fallback
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

  const resolvedType = resolveAudioContentType(audio, contentType);
  const language = speechLocaleFromApp(locale);
  const url =
    `https://${config.region}.stt.speech.microsoft.com` +
    `/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Content-Type": resolvedType,
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
