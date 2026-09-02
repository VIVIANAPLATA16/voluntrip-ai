import { describe, expect, it } from "vitest";
import {
  AZURE_WAV_CONTENT_TYPE,
  inspectWavPcm,
  resolveAudioContentType,
  sniffAudioContentType,
} from "./azureSpeech.server";
import { encodeMonoPcm16ToWav } from "@/lib/audio/wavEncode";

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

describe("azureSpeech audio content-type", () => {
  it("sniffs WebM EBML header", () => {
    const buf = bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(sniffAudioContentType(buf)).toBe("audio/webm");
  });

  it("sniffs WAV and maps Content-Type to Azure PCM with real sample rate", () => {
    const samples = new Float32Array(1600);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.4;
    }
    const wav = encodeMonoPcm16ToWav(samples, 16000);
    expect(sniffAudioContentType(wav)).toBe("audio/wav");
    expect(resolveAudioContentType(wav, "audio/wav")).toBe(
      "audio/wav; codecs=audio/pcm; samplerate=16000"
    );
    const info = inspectWavPcm(wav);
    expect(info?.sampleRate).toBe(16000);
    expect(info?.channels).toBe(1);
    expect(info?.bitsPerSample).toBe(16);
    expect(info?.rms ?? 0).toBeGreaterThan(0.1);
    expect(info?.durationSec).toBeCloseTo(0.1, 2);
  });

  it("keeps AZURE_WAV_CONTENT_TYPE constant aligned", () => {
    expect(AZURE_WAV_CONTENT_TYPE).toContain("samplerate=16000");
  });

  it("sniffs MP4 ftyp box (legacy iOS MediaRecorder path)", () => {
    const arr = new Uint8Array(16);
    arr[4] = 0x66;
    arr[5] = 0x74;
    arr[6] = 0x79;
    arr[7] = 0x70;
    expect(sniffAudioContentType(arr.buffer)).toBe("audio/mp4");
  });

  it("overrides wrong webm declaration when bytes are mp4", () => {
    const arr = new Uint8Array(16);
    arr[4] = 0x66;
    arr[5] = 0x74;
    arr[6] = 0x79;
    arr[7] = 0x70;
    expect(resolveAudioContentType(arr.buffer, "audio/webm")).toBe("audio/mp4");
  });
});
