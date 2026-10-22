import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import type { WhyQloo } from "./types";
import { qlooEvidenceForSheet, readableQlooTagLabel } from "./whyQlooEvidence";

const queriedAt = "2026-10-19T12:00:00.000Z";
const VEGAN = "urn:tag:genre:place:restaurant:vegan";
const UNKNOWN = "urn:tag:genre:place:live_music_venue";

function why(partial: Partial<WhyQloo> & Pick<WhyQloo, "source">): WhyQloo {
  return {
    matchedTags: [],
    rank: 1,
    queriedAt,
    signals: ["salsa", "vida nocturna"],
    totalResults: 10,
    ...partial,
  };
}

function sheetCopy(whyQloo: WhyQloo, usedBaseline = false): string {
  const evidence = qlooEvidenceForSheet(whyQloo, usedBaseline);
  const lines = [
    t("en", evidence.showAsQloo ? "experience.from_qloo" : "experience.not_from_qloo"),
  ];
  if (evidence.showAsQloo && evidence.signals.length > 0) {
    lines.push(t("en", "experience.signals_sent", { signals: evidence.signals.join(", ") }));
  }
  if (evidence.showAsQloo && evidence.entities.length > 0) {
    lines.push(t("en", "experience.entities_sent", { names: evidence.entities.join(", ") }));
  }
  if (evidence.showAsQloo) {
    lines.push(
      t(
        "en",
        evidence.filter ? "experience.ranked_for_filter" : "experience.ranked_for_signals",
        {
          rank: evidence.rank,
          total: evidence.totalResults,
        }
      )
    );
  }
  if (evidence.filter) {
    lines.push(t("en", "experience.filtered_by", { label: evidence.filter }));
  }
  if (evidence.matchedPlaceTags) {
    lines.push(
      t("en", "experience.matched_place_tags", {
        tags: evidence.matchedPlaceTags.join(", "),
      })
    );
  }
  lines.push(`Source: ${evidence.source}`);
  return lines.join("\n");
}

describe("readableQlooTagLabel", () => {
  it("uses the Cultural DNA map label when the id is known", () => {
    expect(readableQlooTagLabel(VEGAN)).toBe("Vegan");
  });

  it("falls back to the last URN segment with spaces and capitals", () => {
    expect(readableQlooTagLabel(UNKNOWN)).toBe("Live Music Venue");
    expect(readableQlooTagLabel("urn:tag:genre:place:nightlife")).toBe("Nightlife");
  });
});

describe("qlooEvidenceForSheet", () => {
  it("fills live Qloo evidence with signals and rank-of-N, omitting empty matched tags", () => {
    const evidence = qlooEvidenceForSheet(why({ source: "qloo" }));
    expect(evidence.showAsQloo).toBe(true);
    expect(evidence.signals).toEqual(["salsa", "vida nocturna"]);
    expect(evidence.rank).toBe(1);
    expect(evidence.totalResults).toBe(10);
    expect(evidence.matchedPlaceTags).toBeNull();

    const copy = sheetCopy(why({ source: "qloo" }));
    expect(copy).toContain("Signals sent to Qloo: salsa, vida nocturna");
    expect(copy).toContain("Ranked #1 of 10 by Qloo for these signals");
    expect(copy).not.toMatch(/Matched/i);
    expect(copy).not.toContain("none");
  });

  it("shows matched place tags as readable labels, not raw URNs", () => {
    const evidence = qlooEvidenceForSheet(why({ source: "qloo", matchedTags: [VEGAN, UNKNOWN] }));
    expect(evidence.matchedPlaceTags).toEqual(["Vegan", "Live Music Venue"]);
    const copy = sheetCopy(why({ source: "qloo", matchedTags: [VEGAN] }));
    expect(copy).toContain("Matched place tags: Vegan");
    expect(copy).not.toContain(VEGAN);
  });

  it("does not present demo or unavailable as Qloo", () => {
    for (const source of ["demo", "unavailable"] as const) {
      const evidence = qlooEvidenceForSheet(
        why({ source, matchedTags: ["urn:tag:genre:place:nightlife"] })
      );
      expect(evidence.showAsQloo).toBe(false);
      expect(evidence.signals).toEqual([]);
      expect(evidence.matchedPlaceTags).toBeNull();

      const copy = sheetCopy(why({ source }));
      expect(copy).toBe(`Not from Qloo\nSource: ${source}`);
      expect(copy).not.toContain("Signals sent to Qloo");
      expect(copy).not.toContain("by Qloo");
      expect(copy).not.toMatch(/Matched/i);
    }
  });

  it("does not present a baseline result as Qloo even if source were qloo", () => {
    const evidence = qlooEvidenceForSheet(why({ source: "qloo" }), true);
    expect(evidence.showAsQloo).toBe(false);
    expect(sheetCopy(why({ source: "qloo" }), true)).not.toContain("by Qloo");
  });

  it("shows Filtered by and in-filter rank only when a live Qloo filter is present", () => {
    expect(sheetCopy(why({ source: "qloo" }))).not.toContain("Filtered by");
    expect(sheetCopy(why({ source: "qloo" }))).toContain(
      "Ranked #1 of 10 by Qloo for these signals"
    );
    const withFilter = sheetCopy(why({ source: "qloo", filter: "nightlife" }));
    expect(withFilter).toContain("Filtered by Qloo tag: nightlife");
    expect(withFilter).toContain("Ranked #1 of 10 by Qloo within the filter");
    expect(withFilter).not.toContain("for these signals");
    expect(sheetCopy(why({ source: "demo", filter: "nightlife" }))).not.toContain("Filtered by");
  });

  it("shows loved entity names on live Qloo results and hides them otherwise", () => {
    const live = sheetCopy(why({ source: "qloo", entities: ["Bad Bunny"] }));
    expect(live).toContain("Entities sent to Qloo: Bad Bunny");
    expect(sheetCopy(why({ source: "demo", entities: ["Bad Bunny"] }))).not.toContain("Bad Bunny");
    expect(sheetCopy(why({ source: "unavailable", entities: ["Bad Bunny"] }))).not.toContain(
      "Entities sent to Qloo"
    );
  });
});
