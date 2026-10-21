import { CULTURAL_DNA_TAG_MAP } from "@/lib/culture/tagMap";
import type { WhyQloo } from "./types";

function titleCaseWords(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Display label for a Qloo tag id. Uses CULTURAL_DNA_TAG_MAP, else the last URN segment. */
export function readableQlooTagLabel(id: string): string {
  const tag = id.trim();
  for (const list of Object.values(CULTURAL_DNA_TAG_MAP)) {
    const mapped = list.find(function (entry) {
      return entry.qlooTagId === tag;
    });
    if (mapped) return titleCaseWords(mapped.label);
  }
  const last = tag.split(":").filter(Boolean).pop() ?? tag;
  return titleCaseWords(last);
}

export type QlooEvidenceForSheet = {
  showAsQloo: boolean;
  signals: string[];
  filter: string | null;
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
    filter: showAsQloo && why.filter ? why.filter : null,
    rank: why.rank,
    totalResults: why.totalResults,
    matchedPlaceTags:
      showAsQloo && why.matchedTags.length > 0
        ? why.matchedTags.map(readableQlooTagLabel)
        : null,
    source: why.source,
    queriedAt: why.queriedAt,
  };
}
