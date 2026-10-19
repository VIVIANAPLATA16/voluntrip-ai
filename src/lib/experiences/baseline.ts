import type { QlooPlace } from "@/lib/qloo/types";
import { rankExperiences, type RankExperiencesInput } from "./rank";
import type { RankedExperiences } from "./types";

/** Always shown with demo provenance. Never labeled as Qloo. */
export const GENERIC_BASELINE_LABEL = "generic, not from Qloo";

/**
 * Small generic Medellín list used when Qloo is OFF.
 * Source is always "demo". culturalFit is 0 because evaluate treats non-qloo as 0.
 */
export const BASELINE_MEDELLIN_PLACES: QlooPlace[] = [
  {
    id: "baseline-medellin-cerro-nutibara",
    name: "Cerro Nutibara lookout",
    tags: [
      { id: "urn:tag:category:place:hiking_area", name: "Hiking area", type: "urn:tag:category:place" },
    ],
    popularity: null,
    priceLevel: null,
    rank: 1,
    neighborhood: "Belén",
  },
  {
    id: "baseline-medellin-jardin-botanico",
    name: "Jardín Botánico stroll",
    tags: [
      { id: "urn:tag:genre:place:park", name: "Park", type: "urn:tag:genre:place" },
    ],
    popularity: null,
    priceLevel: null,
    rank: 2,
    neighborhood: "Aranjuez",
  },
  {
    id: "baseline-medellin-plaza-minorista",
    name: "Plaza Minorista market walk",
    tags: [
      { id: "urn:tag:genre:place:market", name: "Market", type: "urn:tag:genre:place" },
    ],
    popularity: null,
    priceLevel: 1,
    rank: 3,
    neighborhood: "Centro",
  },
];

export function getMedellinBaseline(now: Date = new Date()): {
  source: "demo";
  label: typeof GENERIC_BASELINE_LABEL;
  queriedAt: string;
  candidates: QlooPlace[];
  qlooTotal: number;
} {
  return {
    source: "demo",
    label: GENERIC_BASELINE_LABEL,
    queriedAt: now.toISOString(),
    candidates: BASELINE_MEDELLIN_PLACES.map((place) => ({
      ...place,
      tags: place.tags.map((tag) => ({ ...tag })),
    })),
    qlooTotal: BASELINE_MEDELLIN_PLACES.length,
  };
}

export function rankMedellinBaseline(
  input: Omit<RankExperiencesInput, "candidates" | "source" | "queriedAt" | "qlooTotal">
): RankedExperiences {
  const baseline = getMedellinBaseline(input.now);
  return rankExperiences({
    ...input,
    candidates: baseline.candidates,
    source: baseline.source,
    queriedAt: baseline.queriedAt,
    qlooTotal: baseline.qlooTotal,
  });
}
