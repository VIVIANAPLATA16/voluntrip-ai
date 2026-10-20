import type { WhyQloo } from "./types";

export type QlooEvidenceForSheet = {
  showAsQloo: boolean;
  signals: string[];
  rank: number;
  totalResults: number;
  matchedPlaceTags: string[] | null;
  source: WhyQloo["source"];
  queriedAt: string;
};

/** Evidence lines for Why this? Never claims demo/unavailable came from Qloo. */
export function qlooEvidenceForSheet(
  why: WhyQloo,
  usedBaseline = false
): QlooEvidenceForSheet {
  const showAsQloo = why.source === "qloo" && !usedBaseline;
  return {
    showAsQloo,
    signals: showAsQloo ? why.signals : [],
    rank: why.rank,
    totalResults: why.totalResults,
    matchedPlaceTags:
      showAsQloo && why.matchedTags.length > 0 ? why.matchedTags : null,
    source: why.source,
    queriedAt: why.queriedAt,
  };
}
