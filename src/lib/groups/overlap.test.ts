import { describe, expect, it } from "vitest";
import { groupOverlap, groupTagLabel, groupTasteOverlap } from "./overlap";

const E1 = { id: "550e8400-e29b-41d4-a716-446655440000" };
const E2 = { id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" };
const T1 = "urn:tag:genre:music:salsa";
const T2 = "urn:tag:genre:music:rock";
const T3 = "urn:tag:genre:place:restaurant:japanese";

describe("groupOverlap", () => {
  it("finds tags and entities shared by 2 members", () => {
    const result = groupOverlap([
      { tags: [T1, T2], entities: [E1] },
      { tags: [T1], entities: [E1, E2] },
    ]);
    expect(result.overlap).toBe("shared");
    expect(result.tags).toEqual([{ tag: T1, memberCount: 2 }]);
    expect(result.entities).toEqual([{ id: E1.id, memberCount: 2 }]);
  });

  it("counts a tag shared by 3 members", () => {
    const result = groupOverlap([
      { tags: [T1, T2], entities: [E1] },
      { tags: [T1, T3], entities: [E1] },
      { tags: [T1], entities: [E2] },
    ]);
    expect(result.overlap).toBe("shared");
    expect(result.tags).toEqual([
      { tag: T1, memberCount: 3 },
    ]);
    expect(result.entities).toEqual([{ id: E1.id, memberCount: 2 }]);
  });

  it("returns empty and overlap none when nothing is shared", () => {
    const result = groupOverlap([
      { tags: [T1], entities: [E1] },
      { tags: [T2], entities: [E2] },
    ]);
    expect(result).toEqual({ overlap: "none", tags: [], entities: [] });
  });
});

describe("groupTasteOverlap", () => {
  it("puts tags everyone shares in common", () => {
    const result = groupTasteOverlap([
      { id: "a", alias: "A", tags: [T1, T2] },
      { id: "b", alias: "B", tags: [T1, T2] },
      { id: "c", alias: "C", tags: [T1, T2] },
    ]);
    expect(result.common).toEqual([T1, T2].sort());
    expect(result.almost).toEqual([]);
    expect(result.memberShares.map(function (row) {
      return row.sharedCount;
    })).toEqual([2, 2, 2]);
  });

  it("puts tags shared by more than half, but not all, in almost", () => {
    const result = groupTasteOverlap([
      { id: "a", alias: "A", tags: [T1, T2] },
      { id: "b", alias: "B", tags: [T1] },
      { id: "c", alias: "C", tags: [T3] },
    ]);
    expect(result.common).toEqual([]);
    expect(result.almost).toEqual([T1]);
    expect(result.memberShares.find(function (row) {
      return row.id === "a";
    })?.sharedCount).toBe(1);
  });

  it("keeps each member's known tags even when nobody else overlaps yet", () => {
    const result = groupTasteOverlap([
      { id: "a", alias: "A", tags: [T1, T3] },
      { id: "b", alias: "B", tags: [] },
    ]);
    expect(result.common).toEqual([]);
    expect(result.memberShares.find(function (row) {
      return row.id === "a";
    })?.tags.sort()).toEqual([T1, T3].sort());
    expect(result.memberShares.find(function (row) {
      return row.id === "b";
    })?.tags).toEqual([]);
  });

  it("returns empty overlap when nobody shares", () => {
    const result = groupTasteOverlap([
      { id: "a", alias: "A", tags: [T1] },
      { id: "b", alias: "B", tags: [T2] },
    ]);
    expect(result.common).toEqual([]);
    expect(result.almost).toEqual([]);
    expect(result.memberShares.every(function (row) {
      return row.sharedCount === 0;
    })).toBe(true);
  });

  it("ignores a lone member and members who share nothing", () => {
    const one = groupTasteOverlap([{ id: "a", alias: "A", tags: [T1, T1] }]);
    expect(one.common).toEqual([]);
    expect(one.almost).toEqual([]);
    expect(one.memberShares[0]?.sharedCount).toBe(0);

    const withSilent = groupTasteOverlap([
      { id: "a", alias: "A", tags: [T1] },
      { id: "b", alias: "B", tags: [] },
      { id: "c", alias: "C", tags: [T1, T1] },
    ]);
    expect(withSilent.common).toEqual([T1]);
    expect(withSilent.memberShares.find(function (row) {
      return row.id === "b";
    })?.sharedCount).toBe(0);
  });

  it("drops unknown labels instead of showing raw ids", () => {
    const unknown = "urn:tag:genre:music:not-in-map";
    const result = groupTasteOverlap([
      { id: "a", alias: "A", tags: [T1, unknown] },
      { id: "b", alias: "B", tags: [T1, unknown] },
    ]);
    expect(result.common).toEqual([T1]);
    expect(result.common.join(" ")).not.toContain(unknown);
    expect(groupTagLabel(unknown)).toBeNull();
    expect(groupTagLabel(T1)).toBe("salsa");
  });
});
