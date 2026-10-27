import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { groupsAnonConfig, invokeGroupFunction } from "./rpc";

const ANON = "anon-key-public";
const SERVICE = "service-role-must-never-be-sent";
const URL = "https://example.supabase.co";

const GROUP = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "ABCD2345",
  name: "Ana",
  expiresAt: "2026-11-02T00:00:00.000Z",
  members: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      alias: "Ana",
      tags: [],
      entities: [],
      source: "synced",
    },
  ],
};

describe("groups rpc", () => {
  afterEach(function () {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.unstubAllGlobals();
  });

  it("returns unavailable without env vars", async () => {
    expect(groupsAnonConfig()).toBeNull();
    expect(await invokeGroupFunction("get_group", { p_code: "ABCD2345" })).toEqual({
      ok: false,
      status: "unavailable",
    });
  });

  it("calls PostgREST with the anon key and never the service role", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ group: GROUP, memberId: GROUP.members[0].id }),
      })
    );

    const result = await invokeGroupFunction("create_group", {
      p_code: "ABCD2345",
      p_alias: "Ana",
      p_tags: [],
      p_entities: [],
      p_secret_hash: "a".repeat(64),
    });
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${URL}/rest/v1/rpc/create_group`);
    const headers = new Headers(init.headers);
    expect(headers.get("apikey")).toBe(ANON);
    expect(headers.get("Authorization")).toBe(`Bearer ${ANON}`);
    expect(JSON.stringify(init)).not.toContain(SERVICE);
    expect(String(url)).not.toContain(SERVICE);
  });

  it("maps a missing function or network failure to unavailable", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: "PGRST202", message: "Could not find the function" }),
      })
    );
    expect(await invokeGroupFunction("get_group", { p_code: "ABCD2345" })).toEqual({
      ok: false,
      status: "unavailable",
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await invokeGroupFunction("get_group", { p_code: "ABCD2345" })).toEqual({
      ok: false,
      status: "unavailable",
    });
  });

  it("keeps the SQL contract locked down", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261026223000_groups.sql"),
      "utf8"
    );
    expect(sql).toMatch(/alter table public.groups enable row level security/);
    expect(sql).toMatch(/alter table public.group_members enable row level security/);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toMatch(/revoke all on table public.groups from public, anon, authenticated/);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public/);
    expect(sql).toMatch(/grant execute on function public.create_group/);
    expect(sql).toMatch(/grant execute on function public.get_group/);
    expect(sql).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(sql).toMatch(/jsonb_build_object\(\s*'id', m.id,\s*'alias', m.alias/);
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*secret_hash/);
  });
});
