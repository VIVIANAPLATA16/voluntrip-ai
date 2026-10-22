import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const originalKey = process.env.QLOO_API_KEY;
const SECRET = "super-secret-qloo-key-must-never-leak";
const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440000";

function request(body: unknown) {
  return new Request("http://localhost/api/qloo/entities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/qloo/entities", () => {
  beforeEach(() => {
    process.env.QLOO_API_KEY = SECRET;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.QLOO_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("rejects invalid input with 400 and does not call Qloo", async () => {
    const extra = await POST(request({ query: "Bad Bunny", email: "traveler@example.com" }));
    expect(extra.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();

    const empty = await POST(request({ query: "  " }));
    expect(empty.status).toBe(400);
  });

  it("returns id, name, type only and never leaks the API key", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              name: "Bad Bunny",
              entity_id: ENTITY_ID,
              types: ["urn:entity:artist"],
              akas: ["Benito"],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const ok = await POST(request({ query: "Bad Bunny", take: 3 }));
    const okText = await ok.text();
    expect(okText).not.toContain(SECRET);
    expect(okText).not.toContain("Benito");
    expect(JSON.parse(okText)).toEqual({
      source: "qloo",
      entities: [{ id: ENTITY_ID, name: "Bad Bunny", type: "urn:entity:artist" }],
    });
  });

  it("returns labeled demo when no key is configured", async () => {
    delete process.env.QLOO_API_KEY;
    const res = await POST(request({ query: "Bad Bunny" }));
    expect(res.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({ source: "demo", entities: [], reason: "NO_KEY" });
  });
});
