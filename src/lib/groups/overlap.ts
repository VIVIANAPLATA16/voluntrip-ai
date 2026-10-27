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
