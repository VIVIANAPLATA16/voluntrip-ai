import type { QlooPlace, QlooResult } from "./types";

/** Labeled Medellín fixture. Never presented as a live Qloo response. */
export const DEMO_MEDELLIN_PLACES: QlooPlace[] = [
  {
    id: "demo-medellin-plaza-botero",
    name: "Plaza Botero",
    tags: [
      { id: "urn:tag:genre:place:sculpture", name: "Sculpture", type: "urn:tag:genre:place" },
      { id: "urn:tag:genre:place:local", name: "Local", type: "urn:tag:genre:place" },
    ],
    popularity: 0.82,
    priceLevel: 1,
    rank: 1,
    neighborhood: "La Candelaria",
    address: "Carrera 52, Medellín",
  },
  {
    id: "demo-medellin-cafe-local",
    name: "Café Pergamino",
    tags: [
      { id: "urn:tag:genre:place:coffee", name: "Coffee", type: "urn:tag:genre:place" },
      { id: "urn:tag:genre:place:cafe", name: "Café", type: "urn:tag:genre:place" },
    ],
    popularity: 0.74,
    priceLevel: 2,
    rank: 2,
    neighborhood: "El Poblado",
    address: "Medellín, Colombia",
  },
  {
    id: "demo-medellin-salsa-night",
    name: "El Eslabón Prendido",
    tags: [
      { id: "urn:tag:genre:place:nightlife", name: "Nightlife", type: "urn:tag:genre:place" },
      { id: "urn:tag:genre:place:live_music", name: "Live music", type: "urn:tag:genre:place" },
    ],
    popularity: 0.71,
    priceLevel: 2,
    rank: 3,
    neighborhood: "Centro",
  },
];

export function getDemoPlaces(): Extract<QlooResult, { source: "demo" }> {
  return {
    source: "demo",
    reason: "NO_KEY",
    places: DEMO_MEDELLIN_PLACES.map((place) => ({ ...place, tags: [...place.tags] })),
  };
}
