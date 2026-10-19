import { describe, expect, it } from "vitest";
import { normalizeInsightsResponse, normalizeTagsResponse } from "./normalize";

const validEntity = {
  name: "Café Pergamino",
  entity_id: "AAAA-BBBB",
  subtype: "urn:entity:place",
  popularity: 0.74,
  location: { neighborhood: "El Poblado" },
  tags: [
    {
      id: "urn:tag:genre:place:coffee",
      name: "Coffee",
      type: "urn:tag:genre:place",
      weight: 0.9,
    },
  ],
  properties: {
    price_level: 2,
    neighborhood: "El Poblado",
    address: "Medellín, Colombia",
  },
};

describe("normalizeInsightsResponse", () => {
  it("maps a successful payload and uses 1-based rank", () => {
    const places = normalizeInsightsResponse({
      success: true,
      results: {
        entities: [
          validEntity,
          { ...validEntity, name: "Plaza Botero", entity_id: "CCCC-DDDD" },
        ],
      },
    });

    expect(places).toHaveLength(2);
    expect(places?.[0]).toMatchObject({
      id: "AAAA-BBBB",
      name: "Café Pergamino",
      rank: 1,
      popularity: 0.74,
      priceLevel: 2,
      neighborhood: "El Poblado",
      address: "Medellín, Colombia",
      tags: [
        {
          id: "urn:tag:genre:place:coffee",
          name: "Coffee",
          type: "urn:tag:genre:place",
        },
      ],
    });
    expect(places?.[1]?.rank).toBe(2);
  });

  it("treats tags null and price_level null as optional empties", () => {
    const places = normalizeInsightsResponse({
      success: true,
      results: {
        entities: [
          {
            name: "Parque Lleras",
            entity_id: "EEEE-FFFF",
            popularity: 0.5,
            tags: null,
            properties: { price_level: null },
          },
        ],
      },
    });

    expect(places).toEqual([
      {
        id: "EEEE-FFFF",
        name: "Parque Lleras",
        tags: [],
        popularity: 0.5,
        priceLevel: null,
        rank: 1,
      },
    ]);
  });

  it("returns null for success:false or unexpected shape", () => {
    expect(normalizeInsightsResponse({ success: false, results: { entities: [] } })).toBeNull();
    expect(normalizeInsightsResponse({ success: true, results: {} })).toBeNull();
    expect(normalizeInsightsResponse("not-json-object")).toBeNull();
    expect(normalizeInsightsResponse(null)).toBeNull();
  });

  it("skips entities missing name or entity_id without inventing them", () => {
    const places = normalizeInsightsResponse({
      success: true,
      results: {
        entities: [{ name: "No id" }, { entity_id: "only-id" }, validEntity],
      },
    });
    expect(places).toHaveLength(1);
    expect(places?.[0]?.id).toBe("AAAA-BBBB");
    expect(places?.[0]?.rank).toBe(3);
  });
});

describe("normalizeTagsResponse", () => {
  it("maps tag_id payloads", () => {
    const tags = normalizeTagsResponse({
      success: true,
      results: {
        tags: [{ tag_id: "urn:tag:genre:place:coffee", name: "Coffee", types: ["urn:tag:genre:place"] }],
      },
    });
    expect(tags).toEqual([
      { id: "urn:tag:genre:place:coffee", name: "Coffee", type: "urn:tag:genre:place" },
    ]);
  });
});
