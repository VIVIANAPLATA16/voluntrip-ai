import { describe, expect, it } from "vitest";
import type { CulturalProfile } from "@/types";
import {
  emptyCulturalProfile,
  getConsentedQlooTagIds,
  toStoredCulturalProfile,
} from "./profile";

function profile(overrides: Partial<CulturalProfile> = {}): CulturalProfile {
  return {
    ...emptyCulturalProfile("2026-10-19T00:00:00.000Z"),
    ...overrides,
  };
}

describe("getConsentedQlooTagIds", () => {
  it("returns [] without consent even if tag IDs exist", () => {
    const ids = getConsentedQlooTagIds(
      profile({
        consent: { granted: false, grantedAt: null },
        music: [{ label: "Salsa", qlooTagId: "urn:tag:genre:music:salsa" }],
      })
    );
    expect(ids).toEqual([]);
  });

  it("returns only stored tag IDs when consent is granted", () => {
    const ids = getConsentedQlooTagIds(
      profile({
        consent: { granted: true, grantedAt: "2026-10-19T00:00:00.000Z" },
        music: [{ label: "Salsa", qlooTagId: "urn:tag:genre:music:salsa" }],
        food: [{ label: "Coffee" }],
        entertainment: [{ label: "Film", qlooTagId: "urn:tag:genre:media:film" }],
        activities: [{ label: "Hiking", qlooTagId: "  urn:tag:genre:place:hiking  " }],
      })
    );
    expect(ids).toEqual([
      "urn:tag:genre:music:salsa",
      "urn:tag:genre:media:film",
      "urn:tag:genre:place:hiking",
    ]);
  });

  it("returns [] for a missing profile", () => {
    expect(getConsentedQlooTagIds(null)).toEqual([]);
    expect(getConsentedQlooTagIds(undefined)).toEqual([]);
  });
});

describe("toStoredCulturalProfile", () => {
  it("does not invent qlooTagId values and drops extra identity fields", () => {
    const stored = toStoredCulturalProfile(
      profile({
        music: [{ label: "  Salsa  " }, { label: "Reggaeton", qlooTagId: "" }],
        food: [{ label: "Coffee", qlooTagId: "urn:tag:genre:place:coffee" }],
      })
    );
    expect(stored.id).toBe("default");
    expect(stored.music).toEqual([{ label: "Salsa" }, { label: "Reggaeton" }]);
    expect(stored.food).toEqual([
      { label: "Coffee", qlooTagId: "urn:tag:genre:place:coffee" },
    ]);
    expect(stored).not.toHaveProperty("email");
    expect(stored).not.toHaveProperty("displayName");
    expect(stored).not.toHaveProperty("deviceId");
  });
});
