import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CulturalProfile } from "@/types";

const { createSharedGroup, joinSharedGroup, updateSharedGroupTastes } = vi.hoisted(
  function () {
    return {
      createSharedGroup: vi.fn(),
      joinSharedGroup: vi.fn(),
      updateSharedGroupTastes: vi.fn(),
    };
  }
);

vi.mock("./client", function () {
  return { createSharedGroup, joinSharedGroup, updateSharedGroupTastes };
});

import {
  createGroupFromUi,
  groupErrorText,
  groupSharePayload,
  groupShareTags,
  groupStatusMessageKey,
  setGroupSharing,
} from "./share";

const SALSA = "urn:tag:genre:music:salsa";
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
});

describe("group share client wrappers", () => {
  beforeEach(function () {
    createSharedGroup.mockReset();
    joinSharedGroup.mockReset();
    updateSharedGroupTastes.mockReset();
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
