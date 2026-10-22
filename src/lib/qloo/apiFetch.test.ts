import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchQlooEntities, fetchQlooPlaces } from "./apiFetch";

describe("fetchQlooPlaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /api/qloo and never sends an API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ source: "qloo", places: [] }),
      })
    );

    const result = await fetchQlooPlaces({
      city: "Medellín",
      tags: ["urn:tag:genre:music:salsa"],
      filterTags: ["urn:tag:genre:place:night_club"],
      take: 10,
    });

    expect(result.source).toBe("qloo");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/qloo");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      city: "Medellín",
      tags: ["urn:tag:genre:music:salsa"],
      filterTags: ["urn:tag:genre:place:night_club"],
      take: 10,
    });
    expect(JSON.stringify(init)).not.toMatch(/QLOO|api-key|X-Api-Key/i);
  });

  it("includes entities only when they are provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ source: "qloo", places: [] }),
      })
    );
    const id = "550e8400-e29b-41d4-a716-446655440000";
    await fetchQlooPlaces({ city: "Singapore", entities: [id], take: 10 });
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toEqual({ city: "Singapore", entities: [id], take: 10 });
  });
});

describe("fetchQlooEntities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /api/qloo/entities and never sends an API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          source: "qloo",
          entities: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              name: "Bad Bunny",
              type: "urn:entity:artist",
            },
          ],
        }),
      })
    );
    const result = await fetchQlooEntities("Bad Bunny");
    expect(result.source).toBe("qloo");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/qloo/entities");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ query: "Bad Bunny", take: 5 });
    expect(JSON.stringify(init)).not.toMatch(/QLOO|api-key|X-Api-Key/i);
  });
});
