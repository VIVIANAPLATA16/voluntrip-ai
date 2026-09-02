import { describe, expect, it } from "vitest";
import {
  resolveAudioContentType,
  sniffAudioContentType,
} from "./azureSpeech.server";

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

describe("azureSpeech audio content-type", () => {
  it("sniffs WebM EBML header", () => {
    const buf = bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(sniffAudioContentType(buf)).toBe("audio/webm");
  });

  it("sniffs MP4 ftyp box (iOS MediaRecorder)", () => {
    // size(4) + 'ftyp' + brand
    const arr = new Uint8Array(16);
    arr[4] = 0x66; // f
    arr[5] = 0x74; // t
    arr[6] = 0x79; // y
    arr[7] = 0x70; // p
    expect(sniffAudioContentType(arr.buffer)).toBe("audio/mp4");
  });

  it("overrides wrong webm declaration when bytes are mp4", () => {
    const arr = new Uint8Array(16);
    arr[4] = 0x66;
    arr[5] = 0x74;
    arr[6] = 0x79;
    arr[7] = 0x70;
    expect(resolveAudioContentType(arr.buffer, "audio/webm")).toBe("audio/mp4");
    expect(resolveAudioContentType(arr.buffer, "audio/webm;codecs=opus")).toBe(
      "audio/mp4"
    );
  });

  it("normalizes m4a alias to audio/mp4", () => {
    const arr = new Uint8Array(16);
    arr[4] = 0x66;
    arr[5] = 0x74;
    arr[6] = 0x79;
    arr[7] = 0x70;
    expect(resolveAudioContentType(arr.buffer, "audio/m4a")).toBe("audio/mp4");
  });
});
