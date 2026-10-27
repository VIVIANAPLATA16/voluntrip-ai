import type { CulturalProfile } from "@/types";
import { findCulturalDnaTag, isRetiredSignalTagId } from "@/lib/culture/tagMap";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import {
  createSharedGroup,
  joinSharedGroup,
  updateSharedGroupTastes,
} from "./client";
import { GROUP_MAX_TAGS, type GroupErrStatus, type GroupResult } from "./types";

const LIKE_CATEGORIES = ["music", "food", "entertainment", "activities"] as const;

/** TagMap likes only. Never loved entities, never free text, never unknown URNs. */
export function groupShareTags(profile: CulturalProfile | null | undefined): string[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const category of LIKE_CATEGORIES) {
    for (const like of profile[category]) {
      const id = like.qlooTagId?.trim();
      if (!id || seen.has(id) || isRetiredSignalTagId(id)) continue;
      if (!findCulturalDnaTag(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= GROUP_MAX_TAGS) return out;
    }
  }
  return out;
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

export async function createGroupFromUi(input: {
  groupName: string;
  displayName: string;
  sharing: boolean;
  profile: CulturalProfile | null;
}): Promise<GroupResult> {
  const tastes = groupSharePayload(input.sharing, input.profile);
  const created = await createSharedGroup({
    consentGranted: true,
    alias: input.groupName,
    tags: tastes.tags,
    entities: tastes.entities,
  });
  if (created.status !== "ok") return created;
  if (input.displayName === input.groupName) return created;
  return updateSharedGroupTastes({
    consentGranted: true,
    alias: input.displayName,
    tags: tastes.tags,
    entities: tastes.entities,
  });
}

export async function joinGroupFromUi(input: {
  code: string;
  displayName: string;
  sharing: boolean;
  profile: CulturalProfile | null;
}): Promise<GroupResult> {
  const tastes = groupSharePayload(input.sharing, input.profile);
  return joinSharedGroup({
    consentGranted: true,
    code: input.code,
    alias: input.displayName,
    tags: tastes.tags,
    entities: tastes.entities,
  });
}

export async function setGroupSharing(input: {
  sharing: boolean;
  alias: string;
  profile: CulturalProfile | null;
}): Promise<GroupResult> {
  const tastes = groupSharePayload(input.sharing, input.profile);
  return updateSharedGroupTastes({
    consentGranted: true,
    alias: input.alias,
    tags: tastes.tags,
    entities: tastes.entities,
  });
}
