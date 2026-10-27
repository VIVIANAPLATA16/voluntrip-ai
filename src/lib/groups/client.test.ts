import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMeta, setMeta } = vi.hoisted(function () {
  return { getMeta: vi.fn(), setMeta: vi.fn() };
});

vi.mock("@/lib/db/indexeddb", function () {
  return { getMeta, setMeta };
});

import {
  createSharedGroup,
  joinSharedGroup,
  leaveSharedGroup,
  overlapForResult,
  readSharedGroup,
  updateSharedGroupTastes,
} from "./client";
import { GROUP_META_KEY } from "./types";

const ENTITY = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Bad Bunny",
  type: "urn:entity:artist",
};

const GROUP = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "ABCD2345",
  name: "Ana",
  expiresAt: "2026-11-02T00:00:00.000Z",
  members: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      alias: "Ana",
      tags: ["urn:tag:genre:music:salsa"],
      entities: [ENTITY],
      source: "synced" as const,
    },
  ],
};

const SESSION = {
  groupId: GROUP.id,
  memberId: GROUP.members[0].id,
  secret: "ab".repeat(16),
  code: GROUP.code,
};

describe("groups client", () => {
  beforeEach(function () {
    getMeta.mockReset();
    setMeta.mockReset();
    vi.unstubAllGlobals();
  });

  it("does not send anything without Cultural DNA consent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      consentGranted: false,
      alias: "Ana",
      tags: ["urn:tag:genre:music:salsa"],
      entities: [ENTITY],
    };
    expect(await createSharedGroup(input)).toEqual({ status: "no_consent" });
    expect(await joinSharedGroup({ ...input, code: "ABCD2345" })).toEqual({
      status: "no_consent",
    });
    expect(await updateSharedGroupTastes(input)).toEqual({ status: "no_consent" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setMeta).not.toHaveBeenCalled();
  });

  it("creates a group, stores the local secret, and never expects a hash back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          status: "ok",
          group: GROUP,
          memberId: GROUP.members[0].id,
        }),
      })
    );
    const result = await createSharedGroup({
      consentGranted: true,
      alias: "Ana",
      tags: ["urn:tag:genre:music:salsa"],
      entities: [ENTITY],
    });
    expect(result.status).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.alias).toBe("Ana");
    expect(typeof body.secret).toBe("string");
    expect(body.secret_hash).toBeUndefined();
    expect(setMeta).toHaveBeenCalledWith(
      GROUP_META_KEY,
      expect.objectContaining({
        groupId: GROUP.id,
        memberId: GROUP.members[0].id,
        code: GROUP.code,
        secret: body.secret,
      })
    );
    if (result.status === "ok") {
      expect(JSON.stringify(result)).not.toMatch(/secret_hash/);
      expect(overlapForResult(result).overlap).toBe("none");
    }
  });

  it("reads, updates, and leaves using the stored session", async () => {
    getMeta.mockResolvedValue(SESSION);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ status: "ok", group: GROUP }),
      })
    );
    expect((await readSharedGroup()).status).toBe("ok");
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      code: "ABCD2345",
    });

    await updateSharedGroupTastes({
      consentGranted: true,
      alias: "Ana",
      tags: [],
      entities: [],
    });
    const updateBody = JSON.parse(
      String((vi.mocked(fetch).mock.calls[1] as [string, RequestInit])[1].body)
    );
    expect(updateBody.secret).toBe(SESSION.secret);
    expect(updateBody.groupId).toBe(SESSION.groupId);

    vi.mocked(fetch).mockResolvedValue({ json: async () => ({ status: "ok" }) });
    expect((await leaveSharedGroup()).status).toBe("ok");
    expect(setMeta).toHaveBeenCalledWith(GROUP_META_KEY, null);
  });
});
