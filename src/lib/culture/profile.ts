import type { CulturalLike, CulturalProfile } from "@/types";
import * as db from "@/lib/db/indexeddb";
import { QLOO_ENTITY_UUID, QLOO_MAX_ENTITIES } from "@/lib/qloo/types";
import { findCulturalDnaTag, isRetiredSignalTagId } from "./tagMap";

export const CULTURAL_PROFILE_ID = "default" as const;

const LIKE_CATEGORIES = ["music", "food", "entertainment", "activities"] as const;

function sanitizeLike(raw: CulturalLike): CulturalLike | null {
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label) return null;
  const like: CulturalLike = { label };
  if (typeof raw.qlooTagId === "string") {
    const tag = raw.qlooTagId.trim();
    // Never invent tag IDs — keep only a caller-supplied non-empty value.
    if (tag) like.qlooTagId = tag;
  }
  return like;
}

function sanitizeLikes(raw: CulturalLike[] | undefined): CulturalLike[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeLike)
    .filter((like): like is CulturalLike => like !== null);
}

/**
 * Persist only the operational preference shape.
 * Drops name, email, device IDs, or any other extra field.
 */
export function toStoredCulturalProfile(
  input: CulturalProfile,
  now: string = new Date().toISOString()
): CulturalProfile {
  const granted = Boolean(input.consent?.granted);
  const stored: CulturalProfile = {
    id: CULTURAL_PROFILE_ID,
    consent: {
      granted,
      grantedAt: granted ? input.consent?.grantedAt ?? now : null,
    },
    music: sanitizeLikes(input.music),
    food: sanitizeLikes(input.food),
    entertainment: sanitizeLikes(input.entertainment),
    activities: sanitizeLikes(input.activities),
    updatedAt: input.updatedAt || now,
  };
  if (granted) {
    const loved = sanitizeLovedEntities(input.lovedEntities);
    if (loved.length > 0) stored.lovedEntities = loved;
  }
  return stored;
}

export function emptyCulturalProfile(
  now: string = new Date().toISOString()
): CulturalProfile {
  return {
    id: CULTURAL_PROFILE_ID,
    consent: { granted: false, grantedAt: null },
    music: [],
    food: [],
    entertainment: [],
    activities: [],
    updatedAt: now,
  };
}

function storedTagIds(profile: CulturalProfile): string[] {
  const ids: string[] = [];
  for (const category of LIKE_CATEGORIES) {
    for (const like of profile[category]) {
      const id = like.qlooTagId?.trim();
      if (id) ids.push(id);
    }
  }
  return ids;
}

/**
 * Signal tag IDs that may be sent to Qloo. Empty without consent.
 * Ignores retired nightlife and anything that is not a verified signal.
 */
export function getConsentedQlooTagIds(profile: CulturalProfile | null | undefined): string[] {
  if (!profile?.consent.granted) return [];
  const ids: string[] = [];
  for (const id of storedTagIds(profile)) {
    if (isRetiredSignalTagId(id)) continue;
    const tag = findCulturalDnaTag(id);
    if (tag?.mechanism === "signal" && tag.verifiedAsSignal) ids.push(id);
  }
  return ids;
}

function sanitizeLovedEntities(
  raw: CulturalProfile["lovedEntities"] | undefined
): NonNullable<CulturalProfile["lovedEntities"]> {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<CulturalProfile["lovedEntities"]> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim().toLowerCase() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const type = typeof item.type === "string" ? item.type.trim() : "";
    if (!id || !name || !QLOO_ENTITY_UUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, type });
    if (out.length >= QLOO_MAX_ENTITIES) break;
  }
  return out;
}

/** Loved Qloo entities that may be sent as signal.interests.entities. Empty without consent. */
export function getConsentedLovedEntities(
  profile: CulturalProfile | null | undefined
): NonNullable<CulturalProfile["lovedEntities"]> {
  if (!profile?.consent.granted) return [];
  return sanitizeLovedEntities(profile.lovedEntities);
}

export function hasConsentedTaste(profile: CulturalProfile | null | undefined): boolean {
  if (!profile?.consent.granted) return false;
  return (
    getConsentedQlooTagIds(profile).length > 0 ||
    Boolean(getConsentedFilterTagId(profile)) ||
    getConsentedLovedEntities(profile).length > 0
  );
}

/** At most one verified filter tag. Undefined without consent. */
export function getConsentedFilterTagId(
  profile: CulturalProfile | null | undefined
): string | undefined {
  if (!profile?.consent.granted) return undefined;
  for (const id of storedTagIds(profile)) {
    if (isRetiredSignalTagId(id)) continue;
    const tag = findCulturalDnaTag(id);
    if (tag?.mechanism === "filter" && tag.verifiedAsFilter) return id;
  }
  return undefined;
}

export async function getCulturalProfile(): Promise<CulturalProfile | null> {
  return db.getCulturalProfileRecord();
}

export async function saveCulturalProfile(profile: CulturalProfile): Promise<CulturalProfile> {
  const stored = toStoredCulturalProfile(profile);
  await db.saveCulturalProfileRecord(stored);
  return stored;
}

export async function clearCulturalProfile(): Promise<void> {
  await db.deleteCulturalProfileRecord();
}
