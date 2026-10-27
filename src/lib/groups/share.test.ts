import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CulturalProfile } from "@/types";

const { createSharedGroup, joinSharedGroup, updateSharedGroupTastes, getCulturalProfile } =
  vi.hoisted(function () {
    return {
      createSharedGroup: vi.fn(),
      joinSharedGroup: vi.fn(),
      updateSharedGroupTastes: vi.fn(),
      getCulturalProfile: vi.fn(),
    };
  });

vi.mock("./client", function () {
  return { createSharedGroup, joinSharedGroup, updateSharedGroupTastes };
});

vi.mock("@/lib/culture/profile", function () {
  return { getCulturalProfile };
});

import {
  createGroupFromUi,
  groupErrorText,
  groupShareMissedLikes,
  groupSharePayload,
  groupShareTags,
  groupStatusMessageKey,
  memberReceivedShare,
  profileForShare,
  setGroupSharing,
} from "./share";

const SALSA = "urn:tag:genre:music:salsa";
const ROCK = "urn:tag:genre:music:rock";
const COLOMBIANA = "urn:tag:genre:place:restaurant:colombian";
const UNKNOWN = "urn:tag:genre:music:invented";

function profile(partial: Partial<CulturalProfile> = {}): CulturalProfile {
  return {
    id: "default",
    consent: { granted: false, grantedAt: null },
    music: [{ label: "salsa", qlooTagId: SALSA }],
    food: [],
    entertainment: [],
    activities: [],
    lovedEntities: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Bad Bunny",
        type: "urn:entity:artist",
      },
    ],
    updatedAt: "2026-10-27T00:00:00.000Z",
    ...partial,
  };
}

describe("group share payload", () => {
  it("sends no tastes when sharing is off", () => {
    expect(groupSharePayload(false, profile())).toEqual({ tags: [], entities: [] });
  });

  it("sends only tagMap ids when sharing is on, never free-text entities", () => {
    const tags = groupShareTags(
      profile({
        music: [
          { label: "salsa", qlooTagId: SALSA },
          { label: "made up", qlooTagId: UNKNOWN },
        ],
      })
    );
    expect(tags).toEqual([SALSA]);
    expect(tags.join(" ")).not.toContain(UNKNOWN);
    expect(groupSharePayload(true, profile()).entities).toEqual([]);
    expect(groupSharePayload(true, profile()).tags).not.toContain("Bad Bunny");
  });

  it("shares Cultural DNA signals without Qloo consent, including rock and colombiana", () => {
    const tags = groupShareTags(
      profile({
        consent: { granted: false, grantedAt: null },
        music: [{ label: "rock", qlooTagId: ROCK }],
        food: [{ label: "colombiana", qlooTagId: COLOMBIANA }],
      })
    );
    expect(tags.sort()).toEqual([COLOMBIANA, ROCK].sort());
    expect(groupShareMissedLikes(profile({ music: [{ label: "rock", qlooTagId: ROCK }] }))).toBe(
      false
    );
  });

  it("resolves catalog labels when qlooTagId is missing", () => {
    const tags = groupShareTags(
      profile({
        music: [{ label: "Rock" }],
        food: [{ label: "colombiana" }],
      })
    );
    expect(tags.sort()).toEqual([COLOMBIANA, ROCK].sort());
  });

  it("sends no tags and does not invent likes when the profile is empty", () => {
    expect(groupShareTags(profile({ music: [], food: [], entertainment: [], activities: [] }))).toEqual(
      []
    );
    expect(groupShareMissedLikes(profile({ music: [{ label: "not-a-catalog-like" }] }))).toBe(true);
  });
});

describe("group share client wrappers", () => {
  beforeEach(function () {
    createSharedGroup.mockReset();
    joinSharedGroup.mockReset();
    updateSharedGroupTastes.mockReset();
    getCulturalProfile.mockReset();
    getCulturalProfile.mockResolvedValue(null);
  });

  it("clears tastes when sharing is turned off", async () => {
    updateSharedGroupTastes.mockResolvedValue({ status: "ok", group: { members: [] } });
    await setGroupSharing({ sharing: false, alias: "Ana", profile: profile() });
    expect(updateSharedGroupTastes).toHaveBeenCalledWith({
      consentGranted: true,
      alias: "Ana",
      tags: [],
      entities: [],
    });
  });

  it("uses IndexedDB Cultural DNA when the store snapshot is empty", async () => {
    getCulturalProfile.mockResolvedValue(
      profile({ music: [{ label: "rock", qlooTagId: ROCK }] })
    );
    expect(groupShareTags(await profileForShare(null))).toEqual([ROCK]);
  });

  it("loads Cultural DNA from IndexedDB when the in-memory profile is empty", async () => {
    getCulturalProfile.mockResolvedValue(
      profile({
        music: [{ label: "rock", qlooTagId: ROCK }],
        food: [{ label: "colombiana", qlooTagId: COLOMBIANA }],
      })
    );
    updateSharedGroupTastes.mockResolvedValue({
      status: "ok",
      group: { members: [{ id: "m", tags: [ROCK, COLOMBIANA] }] },
    });
    const result = await setGroupSharing({
      sharing: true,
      alias: "Ana",
      profile: null,
    });
    expect(updateSharedGroupTastes).toHaveBeenCalledWith({
      consentGranted: true,
      alias: "Ana",
      tags: expect.arrayContaining([ROCK, COLOMBIANA]),
      entities: [],
    });
    expect(result.sent.sort()).toEqual([COLOMBIANA, ROCK].sort());
    expect(
      memberReceivedShare(result.sent, [ROCK, COLOMBIANA])
    ).toBe(true);
  });

  it("does not treat an empty update as a successful share of Cultural DNA", () => {
    expect(memberReceivedShare([ROCK, COLOMBIANA], [])).toBe(false);
    expect(memberReceivedShare([ROCK], [ROCK])).toBe(true);
    expect(memberReceivedShare([], [])).toBe(true);
  });

  it("keeps sharing off from sending IndexedDB tastes", async () => {
    getCulturalProfile.mockResolvedValue(profile({ music: [{ label: "rock", qlooTagId: ROCK }] }));
    updateSharedGroupTastes.mockResolvedValue({ status: "ok", group: { members: [] } });
    await setGroupSharing({ sharing: false, alias: "Ana", profile: null });
    expect(updateSharedGroupTastes).toHaveBeenCalledWith({
      consentGranted: true,
      alias: "Ana",
      tags: [],
      entities: [],
    });
  });

  it("creates a group with tagMap likes only when sharing is on", async () => {
    createSharedGroup.mockResolvedValue({
      status: "ok",
      group: { id: "g", code: "ABCD2345", name: "Trip", members: [] },
      memberId: "m",
    });
    await createGroupFromUi({
      groupName: "Trip",
      displayName: "Trip",
      sharing: true,
      profile: profile(),
    });
    expect(createSharedGroup).toHaveBeenCalledWith({
      consentGranted: true,
      alias: "Trip",
      tags: [SALSA],
      entities: [],
    });
  });
});

describe("group error mapping", () => {
  it("never puts a secret into error copy or log-shaped output", () => {
    const secret = "ab".repeat(16);
    const statuses = [
      "unavailable",
      "invalid_code",
      "invalid_alias",
      "alias_taken",
      "group_full",
      "not_found",
      "unauthorized",
      "rate_limited",
      "no_consent",
      "extra_fields",
    ] as const;
    for (const status of statuses) {
      const text = groupErrorText("en", status, secret);
      expect(text).not.toContain(secret);
      expect(text.toLowerCase()).not.toContain("secret");
      expect(groupStatusMessageKey(status)).not.toMatch(/secret/i);
    }
    const dump = JSON.stringify({
      key: groupStatusMessageKey("unauthorized"),
      text: groupErrorText("es", "unauthorized", secret),
    });
    expect(dump).not.toContain(secret);
    expect(dump.toLowerCase()).not.toContain("secret_hash");
  });
});
