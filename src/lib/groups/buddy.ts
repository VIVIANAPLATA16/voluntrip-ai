import { t, type Locale } from "@/lib/i18n/dictionaries";
import { loadGroupSession, readSharedGroup } from "./client";
import { groupTagLabel, groupTasteOverlap } from "./overlap";
import type { GroupResult, GroupSession } from "./types";

export type GroupBuddyMember = {
  alias: string;
  tags: string[];
};

export type GroupBuddyResult =
  | { kind: "no_group" }
  | { kind: "unavailable" }
  | { kind: "none_sharing"; code: string }
  | { kind: "no_match"; code: string }
  | {
      kind: "matches";
      code: string;
      members: GroupBuddyMember[];
      common: string[];
      almost: string[];
    };

export type GroupBuddyDeps = {
  loadSession?: () => Promise<GroupSession | null>;
  readGroup?: () => Promise<GroupResult>;
};

function overlappingTags(selfTags: readonly string[], memberTags: readonly string[]): string[] {
  const mine = new Set(selfTags);
  return memberTags.filter(function (tag) {
    return mine.has(tag);
  });
}

function labeled(ids: readonly string[]): string[] {
  const labels: string[] = [];
  for (const id of ids) {
    const label = groupTagLabel(id);
    if (label) labels.push(label);
  }
  return labels;
}

/**
 * Read-only travel-buddy search for the current invite group.
 * Never returns secrets, member ids, private (empty) tags, or other groups.
 */
export async function findGroupTravelBuddies(
  deps: GroupBuddyDeps = {}
): Promise<GroupBuddyResult> {
  try {
    const loadSession = deps.loadSession ?? loadGroupSession;
    const readGroup = deps.readGroup ?? readSharedGroup;
    const session = await loadSession();
    if (!session) return { kind: "no_group" };

    const result = await readGroup();
    if (result.status !== "ok" || !result.group) return { kind: "unavailable" };

    const overlap = groupTasteOverlap(result.group.members);
    const self = overlap.memberShares.find(function (member) {
      return member.id === session.memberId;
    });
    const selfTags = self?.tags ?? [];
    const candidates = overlap.memberShares.filter(function (member) {
      return member.id !== session.memberId && member.tags.length > 0;
    });

    if (candidates.length === 0) {
      return { kind: "none_sharing", code: result.group.code };
    }

    const members: GroupBuddyMember[] = [];
    for (const candidate of candidates) {
      const tags = overlappingTags(selfTags, candidate.tags);
      if (tags.length === 0) continue;
      members.push({ alias: candidate.alias, tags });
    }

    if (members.length === 0) {
      return { kind: "no_match", code: result.group.code };
    }

    return {
      kind: "matches",
      code: result.group.code,
      members,
      common: overlap.common,
      almost: overlap.almost,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export function formatBuddyReply(locale: Locale, found: GroupBuddyResult): string {
  if (found.kind === "no_group") return t(locale, "navi.buddy.no_group");
  if (found.kind === "unavailable") return t(locale, "navi.buddy.unavailable");
  if (found.kind === "none_sharing") {
    return t(locale, "navi.buddy.none_sharing", { code: found.code });
  }
  if (found.kind === "no_match") {
    return t(locale, "navi.buddy.no_match", { code: found.code });
  }

  const lines = [t(locale, "navi.buddy.matches_intro")];
  for (const member of found.members) {
    const tags = labeled(member.tags).join(", ");
    if (!tags) continue;
    lines.push(t(locale, "navi.buddy.member", { alias: member.alias, tags }));
  }
  const common = labeled(found.common).join(", ");
  if (common) lines.push(t(locale, "navi.buddy.common", { tags: common }));
  const almost = labeled(found.almost).join(", ");
  if (almost) lines.push(t(locale, "navi.buddy.almost", { tags: almost }));
  return lines.join("\n");
}
