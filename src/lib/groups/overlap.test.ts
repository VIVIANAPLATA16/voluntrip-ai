import { describe, expect, it } from "vitest";
import { groupOverlap } from "./overlap";

const E1 = { id: "550e8400-e29b-41d4-a716-446655440000" };
const E2 = { id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" };
const T1 = "urn:tag:genre:music:salsa";
const T2 = "urn:tag:genre:place:nightlife";
const T3 = "urn:tag:genre:food:arepa";

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
