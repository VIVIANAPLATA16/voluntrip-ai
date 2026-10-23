import { describe, expect, it } from "vitest";
import type { Experience, WhyQloo } from "./types";
import { t } from "@/lib/i18n/dictionaries";
import { matchedTagsKind, readableEntityNames, whyThisDetails } from "./whyThisDetails";

const queriedAt = "2026-10-19T12:00:00.000Z";
const VEGAN = "urn:tag:genre:place:restaurant:vegan";
const UNKNOWN = "urn:tag:genre:place:live_music_venue";
const ENTITY_UUID = "550e8400-e29b-41d4-a716-446655440000";

function experience(partial: {
  name?: string;
  valueScore?: number;
  usedWhy?: Partial<WhyQloo> & Pick<WhyQloo, "source">;
}): Experience {
  const why = partial.usedWhy;
  const source = why?.source ?? "qloo";
  return {
    id: "el-social",
    name: partial.name ?? "El Social Salsa",
    neighborhood: "Laureles",
    tags: [{ id: VEGAN, name: "Vegan", type: "urn:tag:genre:place" }],
    popularity: 0.5,
    priceLevel: 2,
    source,
    estimatedCost: { amount: 20, basis: "price_level", isEstimate: true },
    culturalFit: 80,
    financialFit: 70,
    contextFit: 50,
    valueScore: partial.valueScore ?? 72,
    whyQloo: {
      matchedTags: [],
      rank: 1,
      queriedAt,
      signals: [],
      totalResults: 10,
      ...why,
      source,
    },
    whyVoluntrip: {
      estimatedCost: { amount: 20, basis: "price_level", isEstimate: true },
      dailySafeSpendBefore: 40,
      dailySafeSpendAfter: 20,
      protectedMoneyUntouched: true,
      runwayStatus: "on_track",
    },
  };
}

describe("matchedTagsKind", () => {
  it("uses loved-entity copy only when entities were sent and no tags matched", () => {
    expect(matchedTagsKind({ matchedTags: [], entities: ["Bad Bunny"] })).toBe("loved_entities");
    expect(matchedTagsKind({ matchedTags: [], entities: [] })).toBe("none");
    expect(matchedTagsKind({ matchedTags: [VEGAN], entities: ["Bad Bunny"] })).toBe("tags");
    expect(t("en", "experience.ranked_by_loved_entities")).toBe("Ranked by your loved entities");
    expect(t("es", "experience.ranked_by_loved_entities")).toBe("Ordenado según lo que amas");
    expect(t("pt", "experience.ranked_by_loved_entities")).toBe(
      "Ordenado conforme o que você ama"
    );
  });
});

describe("readableEntityNames", () => {
  it("keeps readable names and drops UUIDs, blanks, and duplicates", () => {
    expect(
      readableEntityNames(["Bad Bunny", ENTITY_UUID, "  ", "Bad Bunny", "Karol G"])
    ).toEqual(["Bad Bunny", "Karol G"]);
  });

  it("returns an empty list when Qloo sent no entities", () => {
    expect(readableEntityNames(undefined)).toEqual([]);
    expect(readableEntityNames([])).toEqual([]);
  });
});

describe("whyThisDetails", () => {
  it("surfaces NAVI Why this? fields for a complete live Qloo result", () => {
    const details = whyThisDetails(
      experience({
        usedWhy: {
          source: "qloo",
          matchedTags: [VEGAN, UNKNOWN],
          rank: 2,
          totalResults: 8,
          signals: ["salsa", "vegan"],
          entities: ["Bad Bunny"],
          filter: "nightlife",
        },
      })
    );

    expect(details.name).toBe("El Social Salsa");
    expect(details.valueScore).toBe(72);
    expect(details.evidence.showAsQloo).toBe(true);
    expect(details.evidence.source).toBe("qloo");
    expect(details.evidence.signals).toEqual(["salsa", "vegan"]);
    expect(details.entities).toEqual(["Bad Bunny"]);
    expect(details.entities.join(" ")).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(details.matchedTags).toEqual(["Vegan", "Live Music Venue"]);
    expect(details.matchedTags.join(" ")).not.toContain("urn:");
    expect(details.showMatchedNone).toBe(false);
    expect(details.rankedByLovedEntities).toBe(false);
    expect(details.rank).toBe(2);
    expect(details.evidence.totalResults).toBe(8);
    expect(details.evidence.filter).toBe("nightlife");
  });

  it("shows matched tags as none when live Qloo returned no matches", () => {
    const details = whyThisDetails(
      experience({
        usedWhy: { source: "qloo", matchedTags: [], rank: 3, signals: ["salsa"] },
      })
    );
    expect(details.evidence.showAsQloo).toBe(true);
    expect(details.matchedTags).toEqual([]);
    expect(details.showMatchedNone).toBe(true);
    expect(details.rankedByLovedEntities).toBe(false);
    expect(details.rank).toBe(3);
    expect(details.entities).toEqual([]);
  });

  it("says ranked by loved entities when Qloo used entities but no tags matched", () => {
    const details = whyThisDetails(
      experience({
        usedWhy: {
          source: "qloo",
          matchedTags: [],
          rank: 2,
          entities: ["Bad Bunny"],
          signals: [],
        },
      })
    );
    expect(details.evidence.showAsQloo).toBe(true);
    expect(details.entities).toEqual(["Bad Bunny"]);
    expect(details.matchedTags).toEqual([]);
    expect(details.showMatchedNone).toBe(false);
    expect(details.rankedByLovedEntities).toBe(true);
    expect(details.rank).toBe(2);
  });

  it("does not invent Qloo fields when signals, entities, or filter are missing", () => {
    const details = whyThisDetails(
      experience({
        usedWhy: { source: "qloo", matchedTags: [], signals: [], totalResults: 4, rank: 1 },
      })
    );
    expect(details.evidence.signals).toEqual([]);
    expect(details.entities).toEqual([]);
    expect(details.evidence.filter).toBeNull();
    expect(details.matchedTags).toEqual([]);
    expect(details.showMatchedNone).toBe(true);
    expect(details.rankedByLovedEntities).toBe(false);
    expect(details.rank).toBe(1);
  });

  it("never shows entity UUIDs even if they leak into whyQloo.entities", () => {
    const details = whyThisDetails(
      experience({
        usedWhy: {
          source: "qloo",
          entities: [ENTITY_UUID, "Bad Bunny"],
          matchedTags: [VEGAN],
        },
      })
    );
    expect(details.entities).toEqual(["Bad Bunny"]);
    expect(details.evidence.entities).toEqual(["Bad Bunny"]);
    expect(JSON.stringify(details)).not.toContain(ENTITY_UUID);
  });

  it("does not claim demo, unavailable, or baseline results came from Qloo", () => {
    for (const source of ["demo", "unavailable"] as const) {
      const details = whyThisDetails(
        experience({
          usedWhy: {
            source,
            matchedTags: [VEGAN],
            signals: ["salsa"],
            entities: ["Bad Bunny"],
            filter: "nightlife",
            rank: 1,
          },
        })
      );
      expect(details.evidence.showAsQloo).toBe(false);
      expect(details.evidence.source).toBe(source);
      expect(details.matchedTags).toEqual([]);
      expect(details.showMatchedNone).toBe(false);
      expect(details.rank).toBeNull();
      expect(details.entities).toEqual([]);
      expect(details.evidence.signals).toEqual([]);
      expect(details.evidence.filter).toBeNull();
    }

    const baseline = whyThisDetails(
      experience({
        usedWhy: {
          source: "qloo",
          matchedTags: [VEGAN],
          signals: ["salsa"],
          entities: ["Bad Bunny"],
        },
      }),
      true
    );
    expect(baseline.evidence.showAsQloo).toBe(false);
    expect(baseline.rank).toBeNull();
    expect(baseline.entities).toEqual([]);
    expect(baseline.matchedTags).toEqual([]);
    expect(baseline.showMatchedNone).toBe(false);
  });
});
