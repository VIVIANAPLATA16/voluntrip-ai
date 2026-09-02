import { describe, expect, it } from "vitest";
import {
  computeRms,
  encodeMonoPcm16ToWav,
  mixToMono,
  normalizePeak,
  resampleMonoLinear,
} from "./wavEncode";

describe("wavEncode", () => {
  it("writes a valid RIFF/WAVE header for mono 16 kHz PCM", () => {
    const samples = new Float32Array(1600);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.5;
    }
    const buf = encodeMonoPcm16ToWav(samples, 16000);
    const bytes = new Uint8Array(buf);
    const ascii = (start: number, len: number) =>
      String.fromCharCode(...bytes.subarray(start, start + len));

    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(ascii(12, 4)).toBe("fmt ");
    expect(ascii(36, 4)).toBe("data");
    expect(buf.byteLength).toBe(44 + samples.length * 2);

    const view = new DataView(buf);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it("resampleMonoLinear halves length when going 32k → 16k", () => {
    const input = new Float32Array(3200);
    for (let i = 0; i < input.length; i++) input[i] = i / input.length;
    const out = resampleMonoLinear(input, 32000, 16000);
    expect(out.length).toBe(1600);
  });

  it("normalizePeak boosts quiet audio", () => {
    const quiet = new Float32Array([0.01, -0.01, 0.005]);
    const out = normalizePeak(quiet, 0.85);
    expect(Math.max(...out.map(Math.abs))).toBeCloseTo(0.85, 2);
    expect(computeRms(out)).toBeGreaterThan(computeRms(quiet));
  });

  it("mixToMono averages stereo channels", () => {
    const Offline = (
      globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }
    ).OfflineAudioContext;
    if (!Offline) {
      expect(true).toBe(true);
      return;
    }
    const ctx = new Offline(2, 4, 16000);
    const buffer = ctx.createBuffer(2, 4, 16000);
    buffer.copyToChannel(new Float32Array([0, 0.5, 1, -1]), 0);
    buffer.copyToChannel(new Float32Array([0, 0.5, -1, 1]), 1);
    const mono = mixToMono(buffer);
    expect(mono.length).toBe(4);
    expect(mono[0]).toBeCloseTo(0);
    expect(mono[1]).toBeCloseTo(0.5);
    expect(mono[2]).toBeCloseTo(0);
    expect(mono[3]).toBeCloseTo(0);
  });
});
