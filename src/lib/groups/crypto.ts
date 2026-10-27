import { createHash, randomBytes } from "node:crypto";
import { GROUP_CODE_ALPHABET, GROUP_CODE_LENGTH } from "./types";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateGroupCode(): string {
  const bytes = randomBytes(GROUP_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < GROUP_CODE_LENGTH; i++) {
    out += GROUP_CODE_ALPHABET[bytes[i] % GROUP_CODE_ALPHABET.length];
  }
  return out;
}

export function generateMemberSecret(): string {
  return randomBytes(32).toString("hex");
}
