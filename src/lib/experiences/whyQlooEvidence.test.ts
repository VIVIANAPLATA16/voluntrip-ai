import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/dictionaries";
import type { WhyQloo } from "./types";
import { qlooEvidenceForSheet } from "./whyQlooEvidence";

const queriedAt = "2026-10-19T12:00:00.000Z";

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
  if (evidence.showAsQloo) {
    lines.push(t("en", "experience.signals_sent", { signals: evidence.signals.join(", ") }));
    lines.push(
      t("en", "experience.ranked_for_signals", {
        rank: evidence.rank,
        total: evidence.totalResults,
      })
    );
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

  it("shows matched place tags only when there are coincidences", () => {
    const evidence = qlooEvidenceForSheet(
      why({ source: "qloo", matchedTags: ["urn:tag:genre:place:nightlife"] })
    );
    expect(evidence.matchedPlaceTags).toEqual(["urn:tag:genre:place:nightlife"]);
    expect(sheetCopy(why({ source: "qloo", matchedTags: ["urn:tag:genre:place:nightlife"] }))).toContain(
      "Matched place tags: urn:tag:genre:place:nightlife"
    );
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
});
