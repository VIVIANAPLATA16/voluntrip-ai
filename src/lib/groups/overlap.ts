import { findCulturalDnaTag } from "@/lib/culture/tagMap";
import type {
  GroupEntity,
  GroupOverlap,
  GroupOverlapEntity,
  GroupOverlapTag,
} from "./types";

export type OverlapMember = {
  tags: string[];
  entities: Array<Pick<GroupEntity, "id">>;
};

export function groupOverlap(members: readonly OverlapMember[]): GroupOverlap {
  const tagCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();

  for (const member of members) {
    const tags = new Set(member.tags);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const ids = new Set(
      member.entities.map(function (entity) {
        return entity.id;
      })
    );
    for (const id of ids) {
      entityCounts.set(id, (entityCounts.get(id) ?? 0) + 1);
    }
  }

  const tags: GroupOverlapTag[] = [];
  for (const [tag, memberCount] of tagCounts) {
    if (memberCount >= 2) tags.push({ tag, memberCount });
  }
  tags.sort(function (a, b) {
    return b.memberCount - a.memberCount || a.tag.localeCompare(b.tag);
  });

  const entities: GroupOverlapEntity[] = [];
  for (const [id, memberCount] of entityCounts) {
    if (memberCount >= 2) entities.push({ id, memberCount });
  }
  entities.sort(function (a, b) {
    return b.memberCount - a.memberCount || a.id.localeCompare(b.id);
  });

  if (tags.length === 0 && entities.length === 0) {
    return { overlap: "none", tags: [], entities: [] };
  }
  return { overlap: "shared", tags, entities };
}

/** Unique tagMap ids only. Unknown URNs are dropped, never shown as raw ids. */
export function knownGroupTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id) || !findCulturalDnaTag(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function groupTagLabel(id: string): string | null {
  const tag = findCulturalDnaTag(id);
  return tag ? tag.label : null;
}

export type GroupTasteMember = {
  id: string;
  alias: string;
  tags: string[];
};

export type GroupMemberShare = {
  id: string;
  alias: string;
  sharedCount: number;
};

export type GroupTasteOverlap = {
  common: string[];
  almost: string[];
  memberShares: GroupMemberShare[];
};

/**
 * In-common = every sharing member has the tag.
 * Almost = more than half of sharing members, but not all.
 * Members with no known tags are ignored for those thresholds.
 */
export function groupTasteOverlap(
  members: readonly GroupTasteMember[]
): GroupTasteOverlap {
  const knownByMember = members.map(function (member) {
    return {
      id: member.id,
      alias: member.alias,
      tags: knownGroupTags(member.tags),
    };
  });
  const sharing = knownByMember.filter(function (member) {
    return member.tags.length > 0;
  });
  const n = sharing.length;
  const counts = new Map<string, number>();
  for (const member of sharing) {
    for (const tag of member.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const common: string[] = [];
  const almost: string[] = [];
  if (n >= 2) {
    const half = n / 2;
    for (const [tag, count] of counts) {
      if (count === n) common.push(tag);
      else if (count > half) almost.push(tag);
    }
  }
  common.sort();
  almost.sort();

  const memberShares: GroupMemberShare[] = knownByMember.map(function (member) {
    let sharedCount = 0;
    if (n >= 2 && member.tags.length > 0) {
      for (const tag of member.tags) {
        if ((counts.get(tag) ?? 0) >= 2) sharedCount += 1;
      }
    }
    return { id: member.id, alias: member.alias, sharedCount };
  });

  return { common, almost, memberShares };
}
