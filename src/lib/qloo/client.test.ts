import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchQlooEntities, searchQlooPlaces, searchQlooTags } from "./client";
import { getDemoPlaces } from "./demo";
import { isLiveQlooResult, type QlooResult } from "./types";

const originalKey = process.env.QLOO_API_KEY;
const originalBase = process.env.QLOO_API_BASE_URL;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const livePayload = {
  success: true,
  results: {
    entities: [
      {
        name: "Plaza Botero",
        entity_id: "LIVE-1",
        popularity: 0.8,
        tags: null,
        properties: { price_level: null },
      },
    ],
  },
};

describe("searchQlooPlaces", () => {
  beforeEach(() => {
    process.env.QLOO_API_KEY = "test-key-not-for-production";
    process.env.QLOO_API_BASE_URL = "https://hackathon.api.qloo.com";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.QLOO_API_KEY = originalKey;
    process.env.QLOO_API_BASE_URL = originalBase;
    vi.unstubAllGlobals();
  });

  it("returns source qloo for a valid 200, including null tags and price_level", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, livePayload));

    const result = await searchQlooPlaces({
      city: "Medellín",
      take: 3,
      tags: ["urn:tag:genre:music:salsa"],
      filterTags: ["urn:tag:genre:place:night_club"],
    });

    expect(result.source).toBe("qloo");
    if (result.source !== "qloo") throw new Error("expected live Qloo");
    expect(isLiveQlooResult(result)).toBe(true);
    expect(result.places).toEqual([
      {
        id: "LIVE-1",
        name: "Plaza Botero",
        tags: [],
        popularity: 0.8,
        priceLevel: null,
        rank: 1,
      },
    ]);

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://hackathon.api.qloo.com/v2/insights?");
    expect(url).toContain(encodeURIComponent("urn:entity:place"));
    expect(url).toContain("filter.location.query=");
    expect(url).toContain("signal.interests.tags=");
    expect(url).toContain("filter.tags=");
    expect(url).toContain(encodeURIComponent("urn:tag:genre:place:night_club"));
    expect(url).not.toContain("signal.interests.entities");
    expect(url).not.toContain("email");
    expect(url).not.toContain("transaction");
    expect(init.headers).toMatchObject({ "X-Api-Key": "test-key-not-for-production" });
  });

  it("sends entity UUIDs as signal.interests.entities", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, livePayload));
    const id = "550e8400-e29b-41d4-a716-446655440000";
    await searchQlooPlaces({
      city: "Medellín",
      tags: ["urn:tag:genre:music:salsa"],
      entities: [id],
    });
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("signal.interests.entities=");
    expect(url).toContain(encodeURIComponent(id));
    expect(url).toContain("signal.interests.tags=");
  });

  it("maps 401 and 403 to unavailable / QLOO_AUTH", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(401, { error: { reason: "denied", message: "no", code: 401 } })
    );
    const unauthorized = await searchQlooPlaces({ city: "Medellín" });
    expect(unauthorized).toEqual({ source: "unavailable", places: [], reason: "QLOO_AUTH" });

    vi.mocked(fetch).mockResolvedValue(jsonResponse(403, { error: { reason: "denied" } }));
    const forbidden = await searchQlooPlaces({ city: "Medellín" });
    expect(forbidden).toEqual({ source: "unavailable", places: [], reason: "QLOO_AUTH" });
  });

  it("maps 429 to QLOO_RATE_LIMIT", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(429, { error: { message: "slow down" } }));
    const result = await searchQlooPlaces({ city: "Medellín" });
    expect(result).toEqual({ source: "unavailable", places: [], reason: "QLOO_RATE_LIMIT" });
  });

  it("maps abort to QLOO_TIMEOUT", async () => {
    vi.mocked(fetch).mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        const signal = (init as RequestInit).signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const result = await searchQlooPlaces({ city: "Medellín" }, { timeoutMs: 15 });
    expect(result).toEqual({ source: "unavailable", places: [], reason: "QLOO_TIMEOUT" });
  });

  it("maps invalid JSON and success:false to QLOO_BAD_RESPONSE", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    const invalid = await searchQlooPlaces({ city: "Medellín" });
    expect(invalid).toEqual({ source: "unavailable", places: [], reason: "QLOO_BAD_RESPONSE" });

    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { success: false, results: { entities: [livePayload.results.entities[0]] } })
    );
    const failed = await searchQlooPlaces({ city: "Medellín" });
    expect(failed).toEqual({ source: "unavailable", places: [], reason: "QLOO_BAD_RESPONSE" });
    expect(isLiveQlooResult(failed)).toBe(false);
  });

  it("returns labeled demo / NO_KEY when the API key is missing and does not fetch", async () => {
    delete process.env.QLOO_API_KEY;
    const result = await searchQlooPlaces({ city: "Medellín" });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.source).toBe("demo");
    expect(result).toEqual(getDemoPlaces());
    if (result.source === "demo") {
      expect(result.reason).toBe("NO_KEY");
    }
    expect(isLiveQlooResult(result)).toBe(false);
  });

  it("never labels demo or unavailable as live Qloo", () => {
    const demo: QlooResult = getDemoPlaces();
    const unavailable: QlooResult = {
      source: "unavailable",
      places: [],
      reason: "QLOO_AUTH",
    };
    expect(demo.source === "qloo").toBe(false);
    expect(unavailable.source === "qloo").toBe(false);
    expect(isLiveQlooResult(demo)).toBe(false);
    expect(isLiveQlooResult(unavailable)).toBe(false);
  });
});

describe("searchQlooEntities", () => {
  beforeEach(() => {
    process.env.QLOO_API_KEY = "test-key-not-for-production";
    process.env.QLOO_API_BASE_URL = "https://hackathon.api.qloo.com";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.QLOO_API_KEY = originalKey;
    process.env.QLOO_API_BASE_URL = originalBase;
    vi.unstubAllGlobals();
  });

  it("GETs /search and returns id, name, type without aliases", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        results: [
          {
            name: "Bad Bunny",
            entity_id: id,
            types: ["urn:entity:artist"],
            akas: ["Benito"],
          },
        ],
      })
    );
    const result = await searchQlooEntities({ query: "Bad Bunny", take: 3 });
    expect(result.source).toBe("qloo");
    if (result.source === "qloo") {
      expect(result.entities).toEqual([{ id, name: "Bad Bunny", type: "urn:entity:artist" }]);
      expect(JSON.stringify(result)).not.toContain("Benito");
      expect(JSON.stringify(result)).not.toContain("akas");
    }
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://hackathon.api.qloo.com/search?");
    expect(url).toContain("query=");
    expect(url).toContain("take=3");
  });

  it("returns labeled demo / NO_KEY when the API key is missing", async () => {
    delete process.env.QLOO_API_KEY;
    const result = await searchQlooEntities({ query: "Bad Bunny" });
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ source: "demo", entities: [], reason: "NO_KEY" });
  });
});

describe("searchQlooTags", () => {
  beforeEach(() => {
    process.env.QLOO_API_KEY = "test-key-not-for-production";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.QLOO_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("returns source qloo for a valid tags payload", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        success: true,
        results: {
          tags: [{ id: "urn:tag:genre:place:coffee", name: "Coffee", type: "urn:tag:genre:place" }],
        },
      })
    );
    const result = await searchQlooTags({ query: "coffee", take: 5 });
    expect(result.source).toBe("qloo");
    if (result.source === "qloo") {
      expect(result.tags[0]?.id).toBe("urn:tag:genre:place:coffee");
    }
  });
});

type QlooBranch = Extract<QlooResult, { source: "qloo" }>;
type DemoBranch = Extract<QlooResult, { source: "demo" }>;
type UnavailableBranch = Extract<QlooResult, { source: "unavailable" }>;
type Assert<T extends true> = T;
type _DemoHasReason = Assert<DemoBranch extends { reason: "NO_KEY" } ? true : false>;
type _UnavailableHasReason = Assert<UnavailableBranch extends { reason: string } ? true : false>;
type _LiveHasNoReason = Assert<QlooBranch extends { reason: unknown } ? false : true>;
void 0 as unknown as _DemoHasReason;
void 0 as unknown as _UnavailableHasReason;
void 0 as unknown as _LiveHasNoReason;
