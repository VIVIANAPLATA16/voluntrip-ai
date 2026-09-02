/**
 * Azure Speech-to-Text — SERVER ONLY.
 * Import exclusively from Route Handlers (e.g. src/app/api/navi/speech/route.ts).
 *
 * Preferred path: client converts MediaRecorder output (WebM/MP4/…) to
 * 16 kHz mono PCM WAV before upload. Azure short-audio REST is reliable with:
 *   Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000
 *
 * Magic-byte sniffing remains as a safety fallback if a non-WAV payload arrives.
 */

import type { Locale } from "@/lib/i18n/dictionaries";

/** Exact header Azure expects for 16 kHz mono PCM WAV. */
export const AZURE_WAV_CONTENT_TYPE =
  "audio/wav; codecs=audio/pcm; samplerate=16000";

export interface AzureSpeechConfig {
  key: string;
  region: string;
}

export interface WavPcmInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSec: number;
  rms: number;
}

export interface SpeechDebugInfo {
  bytes: number;
  declared: string;
  contentTypeSent: string;
  sniffed: string | null;
  wav: WavPcmInfo | null;
  azureHttpStatus?: number;
  azureBody?: unknown;
  azureRecognitionStatus?: string;
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
  error?: { message?: string; code?: string };
}

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i] ?? 0);
  return s;
}

/**
 * Detect container from magic bytes. Fallback when client mime is wrong/empty.
 */
export function sniffAudioContentType(audio: ArrayBuffer): string | null {
  const bytes = new Uint8Array(audio);
  if (bytes.length < 12) return null;

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  if (readAscii(bytes, 0, 4) === "OggS") {
    return "audio/ogg";
  }
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
    return "audio/wav";
  }
  if (readAscii(bytes, 0, 3) === "ID3") {
    return "audio/mpeg";
  }
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (readAscii(bytes, 4, 4) === "ftyp") {
    return "audio/mp4";
  }
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    return "audio/aac";
  }

  return null;
}

/** Parse PCM WAV fmt/data for diagnostics (and RMS of first channel). */
export function inspectWavPcm(audio: ArrayBuffer): WavPcmInfo | null {
  const bytes = new Uint8Array(audio);
  if (bytes.length < 44) return null;
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    return null;
  }

  const view = new DataView(audio);
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataBytes = 0;

  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const next = offset + 8 + size + (size % 2); // word-align
    if (id === "fmt " && size >= 16) {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataBytes = size;
      break;
    }
    if (next <= offset) break;
    offset = next;
  }

  if (!sampleRate || dataOffset < 0 || bitsPerSample !== 16) {
    return sampleRate
      ? {
          sampleRate,
          channels,
          bitsPerSample,
          dataBytes,
          durationSec: sampleRate && channels && bitsPerSample
            ? dataBytes / (sampleRate * channels * (bitsPerSample / 8))
            : 0,
          rms: 0,
        }
      : null;
  }

  const sampleCount = Math.floor(dataBytes / 2);
  const maxSamples = Math.min(sampleCount, sampleRate * 30); // cap RMS scan
  let sumSq = 0;
  const step = channels || 1;
  let n = 0;
  for (let i = 0; i < maxSamples; i += step) {
    const s = view.getInt16(dataOffset + i * 2, true) / 32768;
    sumSq += s * s;
    n++;
  }
  const rms = n ? Math.sqrt(sumSq / n) : 0;
  const durationSec =
    sampleRate && channels ? dataBytes / (sampleRate * channels * 2) : 0;

  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes,
    durationSec,
    rms,
  };
}

/**
 * Resolve Content-Type for Azure.
 * WAV (normal path from client) → exact Azure PCM header.
 * Other formats kept as fallback only.
 */
export function resolveAudioContentType(
  audio: ArrayBuffer,
  declared?: string | null
): string {
  const sniffed = sniffAudioContentType(audio);
  const raw = (declared || "").split(";")[0]?.trim().toLowerCase() || "";

  if (sniffed === "audio/wav" || raw === "audio/wav" || raw === "audio/wave" || raw === "audio/x-wav") {
    // Prefer samplerate from the actual WAV header when available
    const info = inspectWavPcm(audio);
    if (info?.sampleRate) {
      return `audio/wav; codecs=audio/pcm; samplerate=${info.sampleRate}`;
    }
    return AZURE_WAV_CONTENT_TYPE;
  }

  if (sniffed) {
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
  if (raw) return raw;
  return sniffed || AZURE_WAV_CONTENT_TYPE;
}

export class SpeechTranscribeError extends Error {
  code: string;
  debug: SpeechDebugInfo;

  constructor(code: string, message: string, debug: SpeechDebugInfo) {
    super(message);
    this.name = "SpeechTranscribeError";
    this.code = code;
    this.debug = debug;
  }
}

/**
 * Transcribe raw audio bytes via Azure Speech REST.
 * Prefer 16 kHz mono PCM WAV from the client.
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
    throw new SpeechTranscribeError("Empty audio", "Empty audio", {
      bytes: 0,
      declared: contentType,
      contentTypeSent: contentType,
      sniffed: null,
      wav: null,
    });
  }

  const sniffed = sniffAudioContentType(audio);
  const wav = sniffed === "audio/wav" ? inspectWavPcm(audio) : null;
  const resolvedType = resolveAudioContentType(audio, contentType);
  const language = speechLocaleFromApp(locale);

  const baseDebug: SpeechDebugInfo = {
    bytes: audio.byteLength,
    declared: contentType,
    contentTypeSent: resolvedType,
    sniffed,
    wav,
  };

  console.info("[navi/speech] prepared", {
    locale: language,
    ...baseDebug,
  });

  // Reject near-silent / tiny clips before Azure (clearer than opaque NoMatch)
  if (wav && wav.durationSec < 0.25) {
    throw new SpeechTranscribeError(
      "NO_SPEECH",
      "Audio too short",
      baseDebug
    );
  }
  if (wav && wav.rms < 0.0005) {
    throw new SpeechTranscribeError(
      "NO_SPEECH",
      "Audio appears silent",
      baseDebug
    );
  }

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

  const rawText = await res.text().catch(() => "");
  let data: SpeechRecognitionResponse = {};
  try {
    data = rawText ? (JSON.parse(rawText) as SpeechRecognitionResponse) : {};
  } catch {
    data = { error: { message: rawText.slice(0, 500) } };
  }

  console.info("[navi/speech] azure response", {
    httpStatus: res.status,
    body: data,
  });

  const debug: SpeechDebugInfo = {
    ...baseDebug,
    azureHttpStatus: res.status,
    azureBody: data,
    azureRecognitionStatus: data.RecognitionStatus,
  };

  if (!res.ok) {
    throw new SpeechTranscribeError(
      "AZURE_HTTP",
      `Azure Speech failed (${res.status})${rawText ? `: ${rawText.slice(0, 200)}` : ""}`,
      debug
    );
  }

  const status = data.RecognitionStatus || "";

  if (status === "Success") {
    const text = (data.DisplayText || "").trim();
    if (!text) {
      throw new SpeechTranscribeError("NO_SPEECH", "Empty transcription", debug);
    }
    return text;
  }

  if (
    status === "NoMatch" ||
    status === "InitialSilenceTimeout" ||
    status === "BabbleTimeout"
  ) {
    throw new SpeechTranscribeError("NO_SPEECH", `Azure status: ${status}`, debug);
  }

  throw new SpeechTranscribeError(
    "AZURE_STATUS",
    `Azure Speech status: ${status || "unknown"}`,
    debug
  );
}
