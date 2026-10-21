import { describe, expect, it } from "vitest";
import type { CulturalProfile } from "@/types";
import {
  emptyCulturalProfile,
  getConsentedFilterTagId,
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

  it("returns only verified signal IDs when consent is granted", () => {
    const ids = getConsentedQlooTagIds(
      profile({
        consent: { granted: true, grantedAt: "2026-10-19T00:00:00.000Z" },
        music: [{ label: "Salsa", qlooTagId: "urn:tag:genre:music:salsa" }],
        food: [{ label: "Coffee" }],
        entertainment: [
          { label: "Nightlife", qlooTagId: "urn:tag:genre:place:nightlife" },
          { label: "Nightlife filter", qlooTagId: "urn:tag:genre:place:night_club" },
        ],
        activities: [{ label: "Hiking", qlooTagId: "  urn:tag:genre:place:hiking  " }],
      })
    );
    expect(ids).toEqual(["urn:tag:genre:music:salsa"]);
  });

  it("returns at most one consented filter id", () => {
    expect(getConsentedFilterTagId(null)).toBeUndefined();
    expect(
      getConsentedFilterTagId(
        profile({
          consent: { granted: false, grantedAt: null },
          entertainment: [{ label: "Nightlife", qlooTagId: "urn:tag:genre:place:night_club" }],
        })
      )
    ).toBeUndefined();
    expect(
      getConsentedFilterTagId(
        profile({
          consent: { granted: true, grantedAt: "2026-10-19T00:00:00.000Z" },
          entertainment: [
            { label: "old nightlife", qlooTagId: "urn:tag:genre:place:nightlife" },
            { label: "Nightlife", qlooTagId: "urn:tag:genre:place:night_club" },
          ],
          activities: [{ label: "Yoga", qlooTagId: "urn:tag:genre:place:yoga_studio" }],
        })
      )
    ).toBe("urn:tag:genre:place:night_club");
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
