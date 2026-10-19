import { describe, expect, it } from "vitest";
import { validateQlooPlaceRequest } from "./request";

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
});
