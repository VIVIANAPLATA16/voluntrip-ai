/**
 * Client-side audio → WAV (PCM 16-bit mono 16 kHz) for Azure Speech short-audio REST.
 * Pure JS — no external deps. Uses linear resample (no OfflineAudioContext) for
 * consistent output across Chrome / Safari / iOS.
 */

export const AZURE_WAV_SAMPLE_RATE = 16_000;

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as WebkitWindow;
  return w.AudioContext || w.webkitAudioContext || null;
}

/** Average all channels into a mono Float32Array. */
export function mixToMono(buffer: AudioBuffer): Float32Array {
  const { length, numberOfChannels } = buffer;
  if (numberOfChannels === 1) {
    // Copy into a fresh ArrayBuffer-backed view (avoid SharedArrayBuffer typing issues)
    const src = buffer.getChannelData(0);
    const out = new Float32Array(src.length);
    out.set(src);
    return out;
  }
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numberOfChannels; c++) {
      sum += buffer.getChannelData(c)[i];
    }
    mono[i] = sum / numberOfChannels;
  }
  return mono;
}

/** Linear interpolation resample — deterministic, no Web Audio quirks. */
export function resampleMonoLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate || samples.length === 0) {
    return samples;
  }
  const ratio = fromRate / toRate;
  const newLen = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(newLen);
  const last = samples.length - 1;
  for (let i = 0; i < newLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, last);
    const t = src - i0;
    out[i] = samples[i0] * (1 - t) + samples[i1] * t;
  }
  return out;
}

/** @deprecated use resampleMonoLinear — kept as async alias for callers. */
export async function resampleMono(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  return resampleMonoLinear(samples, fromRate, toRate);
}

export function computeRms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/** Boost quiet mics toward a usable peak (helps Azure avoid NoMatch on soft speech). */
export function normalizePeak(samples: Float32Array, targetPeak = 0.85): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak < 1e-5 || peak >= targetPeak) return samples;
  const gain = targetPeak / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

/**
 * Encode mono float samples (-1..1) as 16-bit PCM WAV.
 * Returns an ArrayBuffer with a standard 44-byte RIFF header.
 */
export function encodeMonoPcm16ToWav(
  samples: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] || 0));
    // Symmetric 16-bit scaling (avoid -32768 edge quirks)
    const int16 = Math.max(-32767, Math.min(32767, Math.round(s * 32767)));
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return buffer;
}

export interface AzureWavResult {
  blob: Blob;
  sampleRate: number;
  durationSec: number;
  rms: number;
  rawBytes: number;
  wavBytes: number;
  sourceSampleRate: number;
}

/**
 * Decode any MediaRecorder blob (webm/opus, mp4/aac, …) → 16 kHz mono WAV Blob.
 */
export async function blobToAzureWav(blob: Blob): Promise<AzureWavResult> {
  const AudioCtor = getAudioContextCtor();
  if (!AudioCtor) {
    throw new Error("Web Audio API unavailable");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const copy = arrayBuffer.slice(0);

  const audioContext = new AudioCtor();
  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(copy);
    } catch (firstErr) {
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch {
        throw firstErr instanceof Error ? firstErr : new Error("decodeAudioData failed");
      }
    }

    if (!audioBuffer.length) {
      throw new Error("Empty audio buffer");
    }

    const mono = mixToMono(audioBuffer);
    const resampled = resampleMonoLinear(
      mono,
      audioBuffer.sampleRate,
      AZURE_WAV_SAMPLE_RATE
    );
    const normalized = normalizePeak(resampled);
    const rms = computeRms(normalized);
    const wav = encodeMonoPcm16ToWav(normalized, AZURE_WAV_SAMPLE_RATE);
    const wavBlob = new Blob([new Uint8Array(wav)], { type: "audio/wav" });

    return {
      blob: wavBlob,
      sampleRate: AZURE_WAV_SAMPLE_RATE,
      durationSec: normalized.length / AZURE_WAV_SAMPLE_RATE,
      rms,
      rawBytes: blob.size,
      wavBytes: wavBlob.size,
      sourceSampleRate: audioBuffer.sampleRate,
    };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}
