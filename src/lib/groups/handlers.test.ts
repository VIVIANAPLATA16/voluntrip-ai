import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("./rpc", () => ({
  invokeGroupFunction: vi.fn(),
}));

import { invokeGroupFunction } from "./rpc";
import {
  handleCreateGroup,
  handleJoinGroup,
  handleLeaveGroup,
  handleReadGroup,
  handleUpdateMember,
} from "./handlers";
import { POST as createPost } from "@/app/api/groups/route";
import { POST as joinPost } from "@/app/api/groups/join/route";
import { POST as readPost } from "@/app/api/groups/read/route";
import { POST as updatePost } from "@/app/api/groups/update/route";
import { POST as leavePost } from "@/app/api/groups/leave/route";
import { resetGroupRateLimits } from "./http";
import { MAX_GROUP_BODY_BYTES } from "./types";

const invoke = vi.mocked(invokeGroupFunction);
const SECRET = "ab".repeat(16);
const HASH = createHash("sha256").update(SECRET, "utf8").digest("hex");
const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const ENTITY = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Bad Bunny",
  type: "urn:entity:artist",
};

function groupPayload(members = 1) {
  return {
    id: GROUP_ID,
    code: "ABCD2345",
    name: "Ana",
    expiresAt: "2026-11-02T00:00:00.000Z",
    members: Array.from({ length: members }, function (_, index) {
      return {
        id: index === 0 ? MEMBER_ID : `33333333-3333-4333-8333-33333333333${index}`,
        alias: index === 0 ? "Ana" : `M${index}`,
        tags: ["urn:tag:genre:music:salsa"],
        entities: [ENTITY],
        source: "synced" as const,
      };
    }),
  };
}

function request(url: string, body: unknown, ip = "1.1.1.1") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("group handlers", () => {
  beforeEach(function () {
    invoke.mockReset();
    resetGroupRateLimits();
  });

  afterEach(function () {
    vi.unstubAllGlobals();
  });

  it("creates, joins, and reads a group with hashed secrets", async () => {
    invoke.mockResolvedValue({
      ok: true,
      group: groupPayload(),
      memberId: MEMBER_ID,
    });

    const created = await handleCreateGroup({
      alias: "Ana",
      tags: ["urn:tag:genre:music:salsa"],
      entities: [ENTITY],
      secret: SECRET,
    });
    expect(created.status).toBe("ok");
    if (created.status === "ok") {
      expect(created.group.members[0]?.source).toBe("synced");
      expect(JSON.stringify(created)).not.toContain(SECRET);
      expect(JSON.stringify(created)).not.toContain(HASH);
    }
    expect(invoke).toHaveBeenCalledWith(
      "create_group",
      expect.objectContaining({
        p_alias: "Ana",
        p_secret_hash: HASH,
        p_tags: ["urn:tag:genre:music:salsa"],
        p_entities: [ENTITY],
      })
    );
    expect(invoke.mock.calls[0][1]).not.toHaveProperty("secret");
    expect(String(invoke.mock.calls[0][1].p_code)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);

    const joined = await handleJoinGroup({
      code: "ABCD2345",
      alias: "Bo",
      tags: [],
      entities: [],
      secret: SECRET,
    });
    expect(joined.status).toBe("ok");
    expect(invoke).toHaveBeenCalledWith(
      "join_group",
      expect.objectContaining({ p_code: "ABCD2345", p_secret_hash: HASH })
    );

    invoke.mockResolvedValue({ ok: true, group: groupPayload(2) });
    const read = await handleReadGroup({ code: "ABCD2345" });
    expect(read.status).toBe("ok");
    if (read.status === "ok") {
      expect(read.group.members).toHaveLength(2);
      expect(JSON.stringify(read)).not.toMatch(/secret/i);
    }
  });

  it("rejects invalid code, duplicate alias, max members, extra fields, bad tags, bad UUID, HTML alias, and huge bodies", async () => {
    expect((await handleJoinGroup({ code: "OIL10ABC", alias: "Ana", tags: [], entities: [], secret: SECRET })).status).toBe(
      "invalid_code"
    );

    invoke.mockResolvedValue({ ok: false, status: "alias_taken" });
    expect(
      (await handleJoinGroup({ code: "ABCD2345", alias: "Ana", tags: [], entities: [], secret: SECRET })).status
    ).toBe("alias_taken");

    invoke.mockResolvedValue({ ok: false, status: "group_full" });
    expect(
      (await handleJoinGroup({ code: "ABCD2345", alias: "Bo", tags: [], entities: [], secret: SECRET })).status
    ).toBe("group_full");

    expect(
      (
        await handleCreateGroup({
          alias: "Ana",
          tags: [],
          entities: [],
          secret: SECRET,
          email: "x@y.z",
        })
      ).status
    ).toBe("extra_fields");

    expect(
      (
        await handleCreateGroup({
          alias: "Ana",
          tags: ["salsa"],
          entities: [],
          secret: SECRET,
        })
      ).status
    ).toBe("invalid_tags");

    expect(
      (
        await handleCreateGroup({
          alias: "Ana",
          tags: [],
          entities: [{ id: "not-a-uuid", name: "X", type: "artist" }],
          secret: SECRET,
        })
      ).status
    ).toBe("invalid_entities");

    expect(
      (await handleCreateGroup({ alias: "<b>Ana</b>", tags: [], entities: [], secret: SECRET })).status
    ).toBe("invalid_alias");

    const huge = await createPost(
      request("http://localhost/api/groups", "x".repeat(MAX_GROUP_BODY_BYTES + 1))
    );
    expect(huge.status).toBe(413);
    expect(await huge.json()).toEqual({ status: "too_large" });
    expect(invoke).not.toHaveBeenCalledWith("create_group", expect.anything());
  });

  it("requires the correct secret to update or leave", async () => {
    invoke.mockResolvedValue({ ok: false, status: "unauthorized" });
    const update = await handleUpdateMember({
      groupId: GROUP_ID,
      memberId: MEMBER_ID,
      secret: "cd".repeat(16),
      alias: "Ana",
      tags: [],
      entities: [],
    });
    expect(update.status).toBe("unauthorized");
    expect(invoke).toHaveBeenCalledWith(
      "update_member",
      expect.objectContaining({
        p_secret_hash: createHash("sha256").update("cd".repeat(16), "utf8").digest("hex"),
      })
    );

    const leave = await handleLeaveGroup({
      groupId: GROUP_ID,
      memberId: MEMBER_ID,
      secret: "cd".repeat(16),
    });
    expect(leave.status).toBe("unauthorized");

    invoke.mockResolvedValue({ ok: true, left: true });
    const okLeave = await handleLeaveGroup({
      groupId: GROUP_ID,
      memberId: MEMBER_ID,
      secret: SECRET,
    });
    expect(okLeave.status).toBe("ok");
    expect(invoke).toHaveBeenCalledWith(
      "leave_group",
      expect.objectContaining({ p_secret_hash: HASH })
    );
  });

  it("returns unavailable when Supabase is down and never uses the service role key", async () => {
    invoke.mockResolvedValue({ ok: false, status: "unavailable" });
    expect((await handleCreateGroup({ alias: "Ana", tags: [], entities: [], secret: SECRET })).status).toBe(
      "unavailable"
    );
    expect((await handleReadGroup({ code: "ABCD2345" })).status).toBe("unavailable");

    const files = [
      "src/lib/groups/rpc.ts",
      "src/lib/groups/handlers.ts",
      "src/app/api/groups/route.ts",
      "src/app/api/groups/join/route.ts",
      "src/app/api/groups/read/route.ts",
      "src/app/api/groups/update/route.ts",
      "src/app/api/groups/leave/route.ts",
    ];
    for (const file of files) {
      const text = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(text).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(text).not.toContain("createSupabaseServiceClient");
    }
  });

  it("rate-limits join and read by IP", async () => {
    invoke.mockResolvedValue({ ok: true, group: groupPayload(), memberId: MEMBER_ID });
    for (let i = 0; i < 8; i++) {
      const res = await joinPost(
        request("http://localhost/api/groups/join", {
          code: "ABCD2345",
          alias: `A${i}`,
          tags: [],
          entities: [],
          secret: SECRET,
        })
      );
      expect(res.status).not.toBe(429);
    }
    const limited = await joinPost(
      request("http://localhost/api/groups/join", {
        code: "ABCD2345",
        alias: "Z",
        tags: [],
        entities: [],
        secret: SECRET,
      })
    );
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ status: "rate_limited" });
  });

  it("wires the HTTP routes", async () => {
    invoke.mockResolvedValue({ ok: true, group: groupPayload(), memberId: MEMBER_ID });
    const created = await createPost(
      request("http://localhost/api/groups", {
        alias: "Ana",
        tags: [],
        entities: [],
        secret: SECRET,
      })
    );
    expect(created.status).toBe(200);
    invoke.mockResolvedValue({ ok: true, group: groupPayload() });
    expect((await readPost(request("http://localhost/api/groups/read", { code: "ABCD2345" }))).status).toBe(200);
    invoke.mockResolvedValue({ ok: true, group: groupPayload(), memberId: MEMBER_ID });
    expect(
      (
        await updatePost(
          request("http://localhost/api/groups/update", {
            groupId: GROUP_ID,
            memberId: MEMBER_ID,
            secret: SECRET,
            alias: "Ana",
            tags: [],
            entities: [],
          })
        )
      ).status
    ).toBe(200);
    invoke.mockResolvedValue({ ok: true, left: true });
    expect(
      (
        await leavePost(
          request("http://localhost/api/groups/leave", {
            groupId: GROUP_ID,
            memberId: MEMBER_ID,
            secret: SECRET,
          })
        )
      ).status
    ).toBe(200);
  });
});
