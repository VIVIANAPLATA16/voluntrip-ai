import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchQlooPlaces } from "./apiFetch";

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
      take: 10,
    });
    expect(JSON.stringify(init)).not.toMatch(/QLOO|api-key|X-Api-Key/i);
  });
});
