import type { CulturalLike, CulturalProfile } from "@/types";
import { getCulturalProfile } from "@/lib/culture/profile";
import {
  CULTURAL_DNA_TAG_MAP,
  findCulturalDnaTag,
  isRetiredSignalTagId,
  type CulturalDnaTag,
} from "@/lib/culture/tagMap";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import {
  createSharedGroup,
  joinSharedGroup,
  updateSharedGroupTastes,
} from "./client";
import { knownGroupTags } from "./overlap";
import { GROUP_MAX_TAGS, type GroupErrStatus, type GroupResult } from "./types";

const LIKE_CATEGORIES = ["music", "food", "entertainment", "activities"] as const;

function likeSelectsTag(like: CulturalLike, tag: CulturalDnaTag): boolean {
  const id = typeof like.qlooTagId === "string" ? like.qlooTagId.trim() : "";
  if (id && id === tag.qlooTagId) return true;
  const label = typeof like.label === "string" ? like.label.trim().toLowerCase() : "";
  return Boolean(label) && label === tag.label.toLowerCase();
}

/**
 * TagMap likes selected in Cultural DNA. Independent of Qloo consent.
 * Never loved entities, never free text, never unknown URNs.
 */
export function groupShareTags(profile: CulturalProfile | null | undefined): string[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const category of LIKE_CATEGORIES) {
    const likes = Array.isArray(profile[category]) ? profile[category] : [];
    for (const tag of CULTURAL_DNA_TAG_MAP[category]) {
      if (isRetiredSignalTagId(tag.qlooTagId)) continue;
      if (!tag.verifiedAsSignal && !tag.verifiedAsFilter) continue;
      if (!findCulturalDnaTag(tag.qlooTagId)) continue;
      const selected = likes.some(function (like) {
        return likeSelectsTag(like, tag);
      });
      if (!selected || seen.has(tag.qlooTagId)) continue;
      seen.add(tag.qlooTagId);
      out.push(tag.qlooTagId);
      if (out.length >= GROUP_MAX_TAGS) return out;
    }
  }
  return out;
}

/** True when the profile has likes we intended to share but could not map to tagMap. */
export function groupShareMissedLikes(profile: CulturalProfile | null | undefined): boolean {
  if (!profile) return false;
  if (groupShareTags(profile).length > 0) return false;
  for (const category of LIKE_CATEGORIES) {
    const likes = Array.isArray(profile[category]) ? profile[category] : [];
    if (likes.length > 0) return true;
  }
  return false;
}

/** Prefer in-memory Cultural DNA; fall back to IndexedDB so Groups is not stuck with a stale store. */
export async function profileForShare(
  snapshot: CulturalProfile | null | undefined
): Promise<CulturalProfile | null> {
  if (groupShareTags(snapshot).length > 0) return snapshot ?? null;
  try {
    const stored = await getCulturalProfile();
    if (groupShareTags(stored).length > 0) return stored;
    return stored ?? snapshot ?? null;
  } catch {
    return snapshot ?? null;
  }
}

export function memberReceivedShare(sent: string[], tags: string[] | undefined): boolean {
  if (sent.length === 0) return true;
  const have = new Set(knownGroupTags(tags ?? []));
  return sent.every(function (id) {
    return have.has(id);
  });
}

export function groupSharePayload(sharing: boolean, profile: CulturalProfile | null | undefined) {
  return {
    tags: sharing ? groupShareTags(profile) : [],
    entities: [] as [],
  };
}

export function groupsGate(input: { cloud: boolean; offline: boolean }) {
  if (!input.cloud) return "needs_cloud" as const;
  if (input.offline) return "offline" as const;
  return "ok" as const;
}

export function groupStatusMessageKey(status: GroupErrStatus): TranslationKey {
  if (status === "unavailable") return "groups.unavailable";
  if (status === "invalid_code") return "groups.invalid_code";
  if (status === "invalid_alias") return "groups.invalid_alias";
  if (status === "alias_taken") return "groups.alias_taken";
  if (status === "group_full") return "groups.group_full";
  if (status === "not_found") return "groups.not_found";
  if (status === "unauthorized") return "groups.unauthorized";
  if (status === "rate_limited") return "groups.rate_limited";
  if (status === "no_consent") return "groups.error";
  return "groups.error";
}

/** Honest status copy. Never interpolates secrets, ids, or server bodies. */
export function groupErrorText(
  locale: Locale,
  status: GroupErrStatus,
  secret?: string
): string {
  const text = t(locale, groupStatusMessageKey(status));
  if (secret && text.includes(secret)) return t(locale, "groups.error");
  return text;
}

export type GroupShareResult = GroupResult & { sent: string[] };

async function tastesForShare(
  sharing: boolean,
  snapshot: CulturalProfile | null | undefined
) {
  const profile = sharing ? await profileForShare(snapshot) : snapshot ?? null;
  return groupSharePayload(sharing, profile);
}

export async function createGroupFromUi(input: {
  groupName: string;
  displayName: string;
  sharing: boolean;
  profile: CulturalProfile | null;
}): Promise<GroupShareResult> {
  const tastes = await tastesForShare(input.sharing, input.profile);
  const created = await createSharedGroup({
    consentGranted: true,
    alias: input.groupName,
    tags: tastes.tags,
    entities: tastes.entities,
  });
  if (created.status !== "ok") return { ...created, sent: tastes.tags };
  if (input.displayName === input.groupName) return { ...created, sent: tastes.tags };
  const updated = await updateSharedGroupTastes({
    consentGranted: true,
    alias: input.displayName,
    tags: tastes.tags,
    entities: tastes.entities,
  });
  return { ...updated, sent: tastes.tags };
}

export async function joinGroupFromUi(input: {
  code: string;
  displayName: string;
  sharing: boolean;
  profile: CulturalProfile | null;
}): Promise<GroupShareResult> {
  const tastes = await tastesForShare(input.sharing, input.profile);
  const joined = await joinSharedGroup({
    consentGranted: true,
    code: input.code,
    alias: input.displayName,
    tags: tastes.tags,
    entities: tastes.entities,
  });
  return { ...joined, sent: tastes.tags };
}

export async function setGroupSharing(input: {
  sharing: boolean;
  alias: string;
  profile: CulturalProfile | null;
}): Promise<GroupShareResult> {
  const tastes = await tastesForShare(input.sharing, input.profile);
  const result = await updateSharedGroupTastes({
    consentGranted: true,
    alias: input.alias,
    tags: tastes.tags,
    entities: tastes.entities,
  });
  return { ...result, sent: tastes.tags };
}
