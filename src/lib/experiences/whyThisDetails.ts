import { qlooEvidenceForSheet, type QlooEvidenceForSheet } from "./whyQlooEvidence";
import type { Experience } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Keep loved-entity labels human. Drop blanks, duplicates, and raw UUIDs.
 * Does not invent names when Qloo did not send entities.
 */
export function readableEntityNames(names: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names ?? []) {
    const name = raw.trim();
    if (!name || UUID_RE.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export type MatchedTagsKind = "tags" | "none" | "loved_entities";

/**
 * Honest matched-tags caption. Entities without overlapping tags are not "none".
 * Never claims a tag match that did not happen.
 */
export function matchedTagsKind(
  why: { matchedTags: readonly string[]; entities?: readonly string[] }
): MatchedTagsKind {
  if (why.matchedTags.length > 0) return "tags";
  if (readableEntityNames(why.entities).length > 0) return "loved_entities";
  return "none";
}

export type WhyThisDetails = {
  name: string;
  valueScore: number;
  evidence: QlooEvidenceForSheet;
  /** Readable matched tags when live Qloo. Empty + showAsQloo means "none". */
  matchedTags: string[];
  showMatchedNone: boolean;
  rankedByLovedEntities: boolean;
  /** NAVI-style rank; null when the result is not live Qloo. */
  rank: number | null;
  entities: string[];
};

/**
 * Dashboard Why this? fields that NAVI already shows, plus honest Qloo evidence.
 * Wraps `qlooEvidenceForSheet` — does not reimplement provenance.
 */
export function whyThisDetails(
  experience: Experience,
  usedBaseline = false
): WhyThisDetails {
  const evidence = qlooEvidenceForSheet(experience.whyQloo, usedBaseline);
  const entities = readableEntityNames(evidence.entities);
  const matchedTags = evidence.matchedPlaceTags ?? [];
  const kind = matchedTagsKind({
    matchedTags: experience.whyQloo.matchedTags,
    entities,
  });
  return {
    name: experience.name,
    valueScore: experience.valueScore,
    evidence: { ...evidence, entities },
    matchedTags,
    showMatchedNone: evidence.showAsQloo && kind === "none",
    rankedByLovedEntities: evidence.showAsQloo && kind === "loved_entities",
    rank: evidence.showAsQloo ? evidence.rank : null,
    entities,
  };
}
