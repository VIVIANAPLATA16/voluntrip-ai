import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getDemoPlaces } from "@/lib/qloo/demo";

const originalKey = process.env.QLOO_API_KEY;
const SECRET = "super-secret-qloo-key-must-never-leak";

function request(body: unknown) {
  return new Request("http://localhost/api/qloo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/qloo", () => {
  beforeEach(() => {
    process.env.QLOO_API_KEY = SECRET;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.QLOO_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("rejects invalid input with 400 and does not call Qloo", async () => {
    const extra = await POST(request({ city: "Medellín", email: "traveler@example.com" }));
    expect(extra.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();

    const badTag = await POST(request({ city: "Medellín", tags: ["not-a-urn"] }));
    expect(badTag.status).toBe(400);

    const twoFilters = await POST(
      request({
        city: "Medellín",
        filterTags: ["urn:tag:genre:place:night_club", "urn:tag:genre:place:spa"],
      })
    );
    expect(twoFilters.status).toBe(400);

    const tooLong = await POST(request({ city: "x".repeat(81) }));
    expect(tooLong.status).toBe(400);
  });

  it("never returns the API key, even on success or error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          results: {
            entities: [
              {
                name: "Plaza Botero",
                entity_id: "LIVE-1",
                tags: null,
                properties: { price_level: null },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const ok = await POST(request({ city: "Medellín", take: 3 }));
    const okText = await ok.text();
    expect(okText).not.toContain(SECRET);
    expect(JSON.parse(okText).source).toBe("qloo");

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { reason: "denied", message: SECRET } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const unauthorized = await POST(request({ city: "Medellín" }));
    const unauthorizedBody = await unauthorized.json();
    const unauthorizedText = JSON.stringify(unauthorizedBody);
    expect(unauthorizedText).not.toContain(SECRET);
    expect(unauthorizedBody).toEqual({
      source: "unavailable",
      places: [],
      reason: "QLOO_AUTH",
    });
  });

  it("forwards UUID entities to Qloo insights", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          results: {
            entities: [
              {
                name: "Plaza Botero",
                entity_id: "LIVE-1",
                tags: null,
                properties: { price_level: null },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const res = await POST(
      request({ city: "Medellín", entities: [id], tags: ["urn:tag:genre:music:salsa"] })
    );
    expect(res.status).toBe(200);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("signal.interests.entities=");
    expect(url).toContain(encodeURIComponent(id));
    expect(url).toContain("signal.interests.tags=");
  });

  it("returns labeled demo when no key is configured", async () => {
    delete process.env.QLOO_API_KEY;
    const res = await POST(request({ city: "Medellín" }));
    expect(res.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual(getDemoPlaces());
  });
});
