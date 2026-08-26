#!/usr/bin/env node
/**
 * Generates minimal PNG icons for PWA without external image deps.
 * Creates solid-ish PNG via raw zlib — fallback copies SVG note.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPNG(size, rgb = [45, 212, 191]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + size * 3);
  const rows = [];
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.38;
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 3);
    line[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = 1 + x * 3;
      // dark bg
      let r = 7, g = 11, b = 18;
      if (dist < rOuter && dist > rOuter - size * 0.04) {
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      } else if (Math.abs(dx) < size * 0.04 && Math.abs(dy) < rOuter) {
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      } else if (Math.abs(dy) < size * 0.03 && Math.abs(dx) < rOuter * 0.7) {
        r = 56; g = 189; b = 248;
      }
      // corner spark
      if (distFrom(x, y, size * 0.74, size * 0.27) < size * 0.035) {
        r = 241; g = 245; b = 249;
      }
      line[i] = r;
      line[i + 1] = g;
      line[i + 2] = b;
    }
    rows.push(line);
  }
  function distFrom(x, y, ax, ay) {
    return Math.sqrt((x - ax) ** 2 + (y - ay) ** 2);
  }
  void row;
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon-192.png"), createPNG(192));
fs.writeFileSync(path.join(dir, "icon-512.png"), createPNG(512));
fs.writeFileSync(path.join(dir, "apple-touch-icon.png"), createPNG(180));
console.log("Icons generated");
