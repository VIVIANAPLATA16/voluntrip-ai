import { describe, expect, it } from "vitest";
import { validateQlooEntitySearchRequest, validateQlooPlaceRequest } from "./request";

describe("validateQlooPlaceRequest", () => {
  it("accepts a city, optional tags, and take", () => {
    const parsed = validateQlooPlaceRequest({
      city: "Medellín",
      tags: ["urn:tag:genre:place:coffee"],
      take: 5,
    });
    expect(parsed).toEqual({
      ok: true,
      query: {
        city: "Medellín",
        tags: ["urn:tag:genre:place:coffee"],
        take: 5,
      },
    });
  });

  it("rejects extra fields, invalid tags, and out-of-range take", () => {
    expect(validateQlooPlaceRequest({ city: "Medellín", email: "a@b.c" }).ok).toBe(false);
    expect(validateQlooPlaceRequest({ city: "Medellín", userId: "abc" }).ok).toBe(false);
    expect(validateQlooPlaceRequest({ city: "x".repeat(81) }).ok).toBe(false);
    expect(validateQlooPlaceRequest({ city: "Medellín", tags: ["coffee"] }).ok).toBe(false);
    expect(validateQlooPlaceRequest({ city: "Medellín", take: 0 }).ok).toBe(false);
    expect(validateQlooPlaceRequest({ city: "Medellín", take: 11 }).ok).toBe(false);
    expect(validateQlooPlaceRequest({ city: "Medellín", take: 1.5 }).ok).toBe(false);
  });

  it("accepts one filterTags value and rejects two or extras", () => {
    expect(
      validateQlooPlaceRequest({
        city: "Medellín",
        filterTags: ["urn:tag:genre:place:night_club"],
      })
    ).toEqual({
      ok: true,
      query: {
        city: "Medellín",
        filterTags: ["urn:tag:genre:place:night_club"],
      },
    });
    expect(
      validateQlooPlaceRequest({
        city: "Medellín",
        filterTags: ["urn:tag:genre:place:night_club", "urn:tag:genre:place:spa"],
      }).ok
    ).toBe(false);
    expect(
      validateQlooPlaceRequest({
        city: "Medellín",
        filterTags: ["urn:tag:genre:place:night_club"],
        mode: "filter",
      }).ok
    ).toBe(false);
  });

  it("accepts at most 5 UUID entities and leaves omitted entities unchanged", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(
      validateQlooPlaceRequest({
        city: "Medellín",
        tags: ["urn:tag:genre:place:coffee"],
        entities: [id],
      })
    ).toEqual({
      ok: true,
      query: {
        city: "Medellín",
        tags: ["urn:tag:genre:place:coffee"],
        entities: [id],
      },
    });
    expect(validateQlooPlaceRequest({ city: "Lima" })).toEqual({
      ok: true,
      query: { city: "Lima" },
    });
    expect(
      validateQlooPlaceRequest({
        city: "Singapore",
        entities: ["not-a-uuid"],
      }).ok
    ).toBe(false);
    expect(
      validateQlooPlaceRequest({
        city: "Singapore",
        entities: [
          "550e8400-e29b-41d4-a716-446655440000",
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002",
          "550e8400-e29b-41d4-a716-446655440003",
          "550e8400-e29b-41d4-a716-446655440004",
          "550e8400-e29b-41d4-a716-446655440005",
        ],
      }).ok
    ).toBe(false);
  });
});

describe("validateQlooEntitySearchRequest", () => {
  it("accepts a query and rejects extras or an empty query", () => {
    expect(validateQlooEntitySearchRequest({ query: "Bad Bunny" })).toEqual({
      ok: true,
      query: { query: "Bad Bunny" },
    });
    expect(validateQlooEntitySearchRequest({ query: "  " }).ok).toBe(false);
    expect(validateQlooEntitySearchRequest({ query: "Bad Bunny", email: "a@b.c" }).ok).toBe(false);
    expect(validateQlooEntitySearchRequest({ query: "x".repeat(81) }).ok).toBe(false);
  });
});
