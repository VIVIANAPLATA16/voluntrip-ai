import { describe, expect, it, vi } from "vitest";
import type { Pocket, Transaction, Trip } from "@/types";
import type { QlooPlace, QlooResult } from "@/lib/qloo/types";
import {
  CATEGORY_ESTIMATE_USD,
  PRICE_LEVEL_USD,
  dedupePlacesByName,
  discoverExperiences,
  estimateExperienceCost,
  financialFit,
  foldPlaceName,
  getMedellinBaseline,
  isHotelCandidate,
  isNonTouristCandidate,
  NON_TOURIST_ID_MARKERS,
  rankExperiences,
  rankMedellinBaseline,
} from "./index";
import { buildBudgetSnapshot } from "@/lib/finance/budget";

const SALSA = "urn:tag:genre:music:salsa";
const NIGHTLIFE = "urn:tag:genre:place:nightlife";
const JAPANESE = "urn:tag:genre:place:restaurant:japanese";
const PROFILE_TAGS = [SALSA, NIGHTLIFE];

const now = new Date("2026-10-19T12:00:00.000Z");

const trip: Trip = {
  id: "t-med",
  destination: "Medellín, Colombia",
  city: "Medellín",
  country: "Colombia",
  countryCode: "CO",
  flag: "🇨🇴",
  baseCurrency: "USD",
  localCurrency: "COP",
  startDate: "2026-10-01",
  endDate: "2026-10-21",
  initialBudget: 5000,
  includedBenefits: ["accommodation"],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const pockets: Pocket[] = [
  {
    id: "pk-emergency",
    tripId: "t-med",
    name: "Emergency",
    category: "emergency",
    balance: 200,
    allocated: 200,
    protected: true,
    icon: "shield",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [];

const tightTrip: Trip = { ...trip, initialBudget: 220 };
const tightPockets: Pocket[] = [
  {
    ...pockets[0],
    balance: 180,
    allocated: 180,
  },
];

function place(partial: Partial<QlooPlace> & Pick<QlooPlace, "id" | "name" | "rank">): QlooPlace {
  return {
    tags: [],
    popularity: 0.5,
    priceLevel: 2,
    ...partial,
  };
}

function qlooResult(places: QlooPlace[]): Extract<QlooResult, { source: "qloo" }> {
  return { source: "qloo", places };
}

function rankOn(places: QlooPlace[], finance = { trip, transactions, pockets }) {
  return rankExperiences({
    candidates: places,
    source: "qloo",
    queriedAt: now.toISOString(),
    qlooTotal: places.length,
    profileTagIds: PROFILE_TAGS,
    intent: "tonight",
    now,
    ...finance,
  });
}

describe("estimateExperienceCost", () => {
  it("maps price_level bands in USD and always marks isEstimate", () => {
    expect(estimateExperienceCost(place({ id: "p1", name: "A", rank: 1, priceLevel: 1 }))).toEqual({
      amount: PRICE_LEVEL_USD[1],
      basis: "price_level",
      isEstimate: true,
    });
    expect(estimateExperienceCost(place({ id: "p2", name: "B", rank: 1, priceLevel: 4 })).amount).toBe(
      PRICE_LEVEL_USD[4]
    );
  });

  it("uses category estimates when price_level is null and marks isEstimate", () => {
    const nightlife = estimateExperienceCost(
      place({
        id: "n",
        name: "Club",
        rank: 1,
        priceLevel: null,
        tags: [{ id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" }],
      })
    );
    expect(nightlife).toEqual({
      amount: CATEGORY_ESTIMATE_USD.nightlife,
      basis: "category",
      isEstimate: true,
    });

    const cafe = estimateExperienceCost(
      place({
        id: "c",
        name: "Café",
        rank: 1,
        priceLevel: null,
        tags: [{ id: "urn:tag:category:place:cafe", name: "Café", type: "urn:tag:category:place" }],
      })
    );
    expect(cafe).toEqual({
      amount: CATEGORY_ESTIMATE_USD.cafe,
      basis: "category",
      isEstimate: true,
    });

    const other = estimateExperienceCost(
      place({
        id: "o",
        name: "Unknown",
        rank: 1,
        priceLevel: null,
        tags: [{ id: "urn:tag:genre:place:local", name: "Local", type: "urn:tag:genre:place" }],
      })
    );
    expect(other).toEqual({
      amount: CATEGORY_ESTIMATE_USD.other,
      basis: "default",
      isEstimate: true,
    });
  });

  it("treats restaurant tags as the restaurant band when price_level is null", () => {
    const estimate = estimateExperienceCost(
      place({
        id: "sushi",
        name: "Sushi",
        rank: 1,
        priceLevel: null,
        tags: [{ id: JAPANESE, name: "Japanese", type: "urn:tag:genre:place" }],
      })
    );
    expect(estimate.amount).toBe(CATEGORY_ESTIMATE_USD.restaurant);
    expect(estimate.basis).toBe("category");
    expect(estimate.isEstimate).toBe(true);
  });
});

describe("discoverExperiences", () => {
  it("requests take=10, strips hotels, and preserves source", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([
        place({
          id: "club",
          name: "El Social Salsa",
          rank: 1,
          tags: [{ id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "hotel-1",
          name: "Hotel Parque 10",
          rank: 2,
          tags: [{ id: "urn:tag:genre:place:hotel", name: "Hotel", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "hotel-2",
          name: "Boutique stay",
          rank: 3,
          tags: [
            {
              id: "urn:tag:category:place:hotel:boutique",
              name: "Boutique hotel",
              type: "urn:tag:category:place",
            },
          ],
        }),
      ])
    );

    const result = await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: true },
      { searchPlaces, now }
    );

    expect(searchPlaces).toHaveBeenCalledWith({
      city: "Medellín",
      tags: [SALSA],
      take: 10,
    });
    expect(result.source).toBe("qloo");
    expect(result.candidates.map((c) => c.id)).toEqual(["club"]);
    expect(result.qlooTotal).toBe(3);
    expect(result.signals).toEqual(["salsa"]);
  });

  it("sends signals and filterTags separately", async () => {
    const searchPlaces = vi.fn(async () => qlooResult([]));
    const filterId = "urn:tag:genre:place:night_club";
    const result = await discoverExperiences(
      {
        city: "Medellín",
        profileTagIds: PROFILE_TAGS,
        filterTagId: filterId,
        consentGranted: true,
      },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({
      city: "Medellín",
      tags: [SALSA],
      filterTags: [filterId],
      take: 10,
    });
    expect(result.filter).toBe("nightlife");
    expect(result.candidates).toEqual([]);
  });

  it("does not send profile tags without consent", async () => {
    const searchPlaces = vi.fn(async () => qlooResult([]));
    await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: false },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({ city: "Medellín", tags: [], take: 10 });
  });

  it("never labels demo or unavailable results as qloo", async () => {
    const demo = await discoverExperiences(
      { city: "Medellín", profileTagIds: [], consentGranted: false },
      {
        now,
        searchPlaces: async () => ({
          source: "demo",
          reason: "NO_KEY",
          places: [
            place({
              id: "demo-1",
              name: "Demo café",
              rank: 1,
              tags: [{ id: "urn:tag:category:place:cafe", name: "Café", type: "urn:tag:category:place" }],
            }),
          ],
        }),
      }
    );
    expect(demo.source).toBe("demo");
    expect(demo.candidates[0]?.id).toBe("demo-1");
    expect(demo.signals).toEqual([]);

    const unavailable = await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: true },
      {
        now,
        searchPlaces: async () => ({
          source: "unavailable",
          places: [],
          reason: "QLOO_NETWORK",
        }),
      }
    );
    expect(unavailable.source).toBe("unavailable");
    expect(unavailable.candidates).toEqual([]);
    expect(unavailable.signals).toEqual([]);
  });

  const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440000";

  function lodgingPlace(id: string, name: string, rank: number, tagId: string, tagName: string): QlooPlace {
    return place({
      id,
      name,
      rank,
      tags: [{ id: tagId, name: tagName, type: "urn:tag:genre:place" }],
    });
  }

  it("does not send entities without consent", async () => {
    const searchPlaces = vi.fn(async () => qlooResult([]));
    await discoverExperiences(
      {
        city: "Singapore",
        profileTagIds: PROFILE_TAGS,
        entityIds: [ENTITY_ID],
        entityNames: ["Bad Bunny"],
        consentGranted: false,
      },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({ city: "Singapore", tags: [], take: 10 });
  });

  it("sends entities with an existing type filter and is city-agnostic", async () => {
    const filterId = "urn:tag:genre:place:night_club";
    for (const city of ["Medellín", "Singapore", "Lima"]) {
      const searchPlaces = vi.fn(async () => qlooResult([]));
      await discoverExperiences(
        {
          city,
          profileTagIds: PROFILE_TAGS,
          filterTagId: filterId,
          entityIds: [ENTITY_ID],
          entityNames: ["Bad Bunny"],
          consentGranted: true,
        },
        { searchPlaces, now }
      );
      expect(searchPlaces).toHaveBeenCalledWith({
        city,
        tags: [SALSA],
        filterTags: [filterId],
        entities: [ENTITY_ID],
        take: 10,
      });
    }
  });

  it("dedupes by folded name and strips lodging tags without city name lists", () => {
    expect(foldPlaceName("Café Pergamino")).toBe("cafe pergamino");
    expect(
      dedupePlacesByName([
        place({ id: "a", name: "Café Pergamino", rank: 1 }),
        place({ id: "b", name: "Cafe Pergamino", rank: 2 }),
      ]).map(function (item) {
        return item.id;
      })
    ).toEqual(["a"]);
    expect(
      isHotelCandidate({
        tags: [{ id: "urn:tag:category:place:lodging", name: "Lodging", type: "urn:tag:category:place" }],
      })
    ).toBe(true);
    expect(
      isHotelCandidate({
        tags: [{ id: "urn:tag:genre:place:bar", name: "Bar", type: "urn:tag:genre:place" }],
      })
    ).toBe(false);
  });

  it("drops Singapore hotel mixes below 3 after lodging strip when entities are used", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([
        lodgingPlace("mbs", "Marina Bay Sands", 1, "urn:tag:genre:place:hotel", "Hotel"),
        lodgingPlace("ritz", "The Ritz-Carlton", 2, "urn:tag:category:place:lodging", "Lodging"),
        lodgingPlace("fullerton", "Fullerton Bay", 3, "urn:tag:genre:place:resort", "Resort"),
        lodgingPlace("pullman", "Pullman", 4, "urn:tag:category:place:accommodation", "Accommodation"),
        place({
          id: "bar-1",
          name: "Clarke Quay Bar",
          rank: 5,
          tags: [{ id: "urn:tag:genre:place:bar", name: "Bar", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "cafe-1",
          name: "Café Bon",
          rank: 6,
          tags: [{ id: "urn:tag:genre:place:cafe", name: "Cafe", type: "urn:tag:genre:place" }],
        }),
      ])
    );
    const result = await discoverExperiences(
      {
        city: "Singapore",
        profileTagIds: [],
        entityIds: [ENTITY_ID],
        entityNames: ["Bad Bunny"],
        consentGranted: true,
      },
      { searchPlaces, now }
    );
    expect(result.source).toBe("qloo");
    expect(result.candidates).toEqual([]);
    expect(result.entities).toEqual(["Bad Bunny"]);
    expect(result.qlooTotal).toBe(6);
  });

  it("keeps a city without hotels when at least 3 places remain", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([
        place({
          id: "lima-1",
          name: "Bar Queirolo",
          rank: 1,
          tags: [{ id: "urn:tag:genre:place:bar", name: "Bar", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "lima-2",
          name: "Ayahuasca",
          rank: 2,
          tags: [{ id: "urn:tag:genre:place:bar", name: "Bar", type: "urn:tag:genre:place" }],
        }),
        place({
          id: "lima-3",
          name: "Café Bisetti",
          rank: 3,
          tags: [{ id: "urn:tag:genre:place:cafe", name: "Cafe", type: "urn:tag:genre:place" }],
        }),
      ])
    );
    const result = await discoverExperiences(
      {
        city: "Lima",
        profileTagIds: [],
        entityIds: [ENTITY_ID],
        entityNames: ["Bad Bunny"],
        consentGranted: true,
      },
      { searchPlaces, now }
    );
    expect(result.source).toBe("qloo");
    expect(result.candidates.map(function (item) {
      return item.id;
    })).toEqual(["lima-1", "lima-2", "lima-3"]);
  });

  it("does not empty a short list when entities were not sent", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([
        lodgingPlace("hotel", "Hotel Parque 10", 1, "urn:tag:genre:place:hotel", "Hotel"),
        place({
          id: "club",
          name: "El Social Salsa",
          rank: 2,
          tags: [{ id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" }],
        }),
      ])
    );
    const result = await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: true },
      { searchPlaces, now }
    );
    expect(result.candidates.map(function (item) {
      return item.id;
    })).toEqual(["club"]);
  });

  const UUID_A = "550e8400-e29b-41d4-a716-44665544000a";
  const UUID_B = "550e8400-e29b-41d4-a716-44665544000b";

  function barPlace(id: string, name: string, rank: number): QlooPlace {
    return place({
      id,
      name,
      rank,
      tags: [{ id: "urn:tag:genre:place:bar", name: "Bar", type: "urn:tag:genre:place" }],
    });
  }

  function entityUuid(n: number): string {
    return `550e8400-e29b-41d4-a716-44665544000${n}`;
  }

  function whyQlooEntities(
    candidates: QlooPlace[],
    entityNames: readonly string[] | undefined
  ): string[] | undefined {
    const ranked = rankExperiences({
      candidates,
      source: "qloo",
      queriedAt: now.toISOString(),
      qlooTotal: candidates.length,
      profileTagIds: [],
      intent: "tonight",
      entities: entityNames,
      now,
      trip,
      transactions,
      pockets,
    });
    return ranked.all[0]?.whyQloo.entities;
  }

  it("empties candidates below 3 after hotel and dedupe when entities are used, and keeps exactly 3", async () => {
    const twoBars = [
      lodgingPlace("hotel", "Hotel One", 1, "urn:tag:genre:place:hotel", "Hotel"),
      barPlace("bar-1", "Bar Uno", 2),
      barPlace("bar-2", "Bar Dos", 3),
    ];
    const below = await discoverExperiences(
      {
        city: "Singapore",
        profileTagIds: [],
        entityIds: [ENTITY_ID],
        entityNames: ["Bad Bunny"],
        consentGranted: true,
      },
      { searchPlaces: vi.fn(async () => qlooResult(twoBars)), now }
    );
    expect(below.source).toBe("qloo");
    expect(below.candidates).toEqual([]);

    const threeBars = [barPlace("a", "Alpha", 1), barPlace("b", "Beta", 2), barPlace("c", "Gamma", 3)];
    const exact = await discoverExperiences(
      {
        city: "Lima",
        profileTagIds: [],
        entityIds: [ENTITY_ID],
        entityNames: ["Bad Bunny"],
        consentGranted: true,
      },
      { searchPlaces: vi.fn(async () => qlooResult(threeBars)), now }
    );
    expect(exact.candidates.map(function (item) {
      return item.id;
    })).toEqual(["a", "b", "c"]);
  });

  it("still shows 1 or 2 places when entities are omitted", async () => {
    const twoBars = [barPlace("bar-1", "Bar Uno", 1), barPlace("bar-2", "Bar Dos", 2)];
    const two = await discoverExperiences(
      { city: "Medellín", profileTagIds: PROFILE_TAGS, consentGranted: true },
      { searchPlaces: vi.fn(async () => qlooResult(twoBars)), now }
    );
    expect(two.candidates.map(function (item) {
      return item.id;
    })).toEqual(["bar-1", "bar-2"]);
    expect(two.entities).toBeUndefined();
  });

  it("pairs each entity id with its name so invalid ids cannot shift whyQloo labels", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([barPlace("a", "Alpha", 1), barPlace("b", "Beta", 2), barPlace("c", "Gamma", 3)])
    );
    const result = await discoverExperiences(
      {
        city: "Lima",
        profileTagIds: [],
        entityIds: [UUID_A, "no-es-uuid", UUID_B],
        entityNames: ["A", "X", "B"],
        consentGranted: true,
      },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({
      city: "Lima",
      tags: [],
      entities: [UUID_A, UUID_B],
      take: 10,
    });
    expect(result.entities).toEqual(["A", "B"]);
    expect(result.entities).not.toContain("X");
    expect(whyQlooEntities(result.candidates, result.entities)).toEqual(["A", "B"]);
  });

  it("sends a repeated UUID once regardless of case", async () => {
    const searchPlaces = vi.fn(async () =>
      qlooResult([barPlace("a", "Alpha", 1), barPlace("b", "Beta", 2), barPlace("c", "Gamma", 3)])
    );
    const result = await discoverExperiences(
      {
        city: "Medellín",
        profileTagIds: [],
        entityIds: [UUID_A.toUpperCase(), UUID_A],
        entityNames: ["A", "A duplicate"],
        consentGranted: true,
      },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({
      city: "Medellín",
      tags: [],
      entities: [UUID_A],
      take: 10,
    });
    expect(result.entities).toEqual(["A"]);
    expect(whyQlooEntities(result.candidates, result.entities)).toEqual(["A"]);
  });

  it("sends at most 5 entities and whyQloo lists only those five names", async () => {
    const ids = [0, 1, 2, 3, 4, 5, 6].map(entityUuid);
    const names = ["N0", "N1", "N2", "N3", "N4", "N5", "N6"];
    const searchPlaces = vi.fn(async () =>
      qlooResult([barPlace("a", "Alpha", 1), barPlace("b", "Beta", 2), barPlace("c", "Gamma", 3)])
    );
    const result = await discoverExperiences(
      {
        city: "Singapore",
        profileTagIds: [],
        entityIds: ids,
        entityNames: names,
        consentGranted: true,
      },
      { searchPlaces, now }
    );
    expect(searchPlaces).toHaveBeenCalledWith({
      city: "Singapore",
      tags: [],
      entities: ids.slice(0, 5),
      take: 10,
    });
    expect(result.entities).toEqual(["N0", "N1", "N2", "N3", "N4"]);
    expect(whyQlooEntities(result.candidates, result.entities)).toEqual([
      "N0",
      "N1",
      "N2",
      "N3",
      "N4",
    ]);
  });

  function taggedPlace(id: string, name: string, rank: number, tagId: string, tagName: string): QlooPlace {
    return place({
      id,
      name,
      rank,
      tags: [{ id: tagId, name: tagName, type: "urn:tag:genre:place" }],
    });
  }

  const CITY_MIX: Record<
    string,
    { places: QlooPlace[]; keep: string[] }
  > = {
    Medellín: {
      places: [
        taggedPlace("u", "Universidad de Antioquia", 1, "urn:tag:genre:place:university", "University"),
        taggedPlace("bar", "El Social Salsa", 2, "urn:tag:genre:place:bar", "Bar"),
        taggedPlace("cafe", "Café Pergamino", 3, "urn:tag:genre:place:cafe", "Cafe"),
        taggedPlace("condo", "Conjunto Residencial", 4, "urn:tag:category:place:condominium", "Condominium"),
        taggedPlace("comedy", "Delirio", 5, "urn:tag:genre:place:comedy_club", "Comedy club"),
      ],
      keep: ["bar", "cafe", "comedy"],
    },
    Singapore: {
      places: [
        taggedPlace("school", "National University", 1, "urn:tag:genre:place:school", "School"),
        taggedPlace("karaoke", "KBox", 2, "urn:tag:genre:place:restaurant:karaoke_bar", "Karaoke"),
        taggedPlace("casino", "Marina Bay Casino", 3, "urn:tag:genre:place:casino", "Casino"),
        taggedPlace("hospital", "Singapore General", 4, "urn:tag:genre:place:hospital", "Hospital"),
        taggedPlace("bar", "Clarke Quay Bar", 5, "urn:tag:genre:place:bar", "Bar"),
      ],
      keep: ["karaoke", "casino", "bar"],
    },
    Lima: {
      places: [
        taggedPlace(
          "u",
          "Universidad Jaime Bausate y Meza",
          1,
          "urn:tag:genre:place:university",
          "University"
        ),
        taggedPlace(
          "condo",
          "Condominio Asia Azul",
          2,
          "urn:tag:category:place:condominium",
          "Condominium"
        ),
        taggedPlace("bar", "Ayahuasca", 3, "urn:tag:genre:place:bar", "Bar"),
        taggedPlace("cafe", "Café Bisetti", 4, "urn:tag:genre:place:cafe", "Cafe"),
        taggedPlace("clinic", "Clínica San Felipe", 5, "urn:tag:genre:place:clinic", "Clinic"),
        taggedPlace("comedy", "El Club de la Comedia", 6, "urn:tag:genre:place:comedy_club", "Comedy club"),
      ],
      keep: ["bar", "cafe", "comedy"],
    },
  };

  it("keeps tourist places and drops non-tourist tags in Medellín, Singapore and Lima", async () => {
    for (const city of ["Medellín", "Singapore", "Lima"]) {
      const mix = CITY_MIX[city];
      const searchPlaces = vi.fn(async () => qlooResult(mix.places));
      const result = await discoverExperiences(
        {
          city,
          profileTagIds: [],
          entityIds: [ENTITY_ID],
          entityNames: ["Bad Bunny"],
          consentGranted: true,
        },
        { searchPlaces, now }
      );
      expect(result.source).toBe("qloo");
      expect(result.candidates.map(function (item) {
        return item.id;
      })).toEqual(mix.keep);
    }
  });

  it("empties below 3 after non-tourist strip when entities are used, and keeps 1–2 without entities", async () => {
    const mixed = [
      taggedPlace("u", "Universidad Jaime Bausate y Meza", 1, "urn:tag:genre:place:university", "University"),
      taggedPlace("condo", "Condominio Asia Azul", 2, "urn:tag:category:place:condominium", "Condominium"),
      barPlace("bar-1", "Ayahuasca", 3),
      barPlace("bar-2", "Bar Queirolo", 4),
    ];
    const withEntities = await discoverExperiences(
      {
        city: "Lima",
        profileTagIds: [],
        entityIds: [ENTITY_ID],
        entityNames: ["Bad Bunny"],
        consentGranted: true,
      },
      { searchPlaces: vi.fn(async () => qlooResult(mixed)), now }
    );
    expect(withEntities.source).toBe("qloo");
    expect(withEntities.candidates).toEqual([]);

    const without = await discoverExperiences(
      { city: "Lima", profileTagIds: PROFILE_TAGS, consentGranted: true },
      { searchPlaces: vi.fn(async () => qlooResult(mixed)), now }
    );
    expect(without.source).toBe("qloo");
    expect(without.candidates.map(function (item) {
      return item.id;
    })).toEqual(["bar-1", "bar-2"]);
  });
});

describe("isNonTouristCandidate", () => {
  function tagged(
    tagId: string,
    name = "Place",
    extra: Partial<QlooPlace> = {}
  ): Pick<QlooPlace, "tags" | "name"> & Partial<QlooPlace> {
    return {
      name,
      tags: [{ id: tagId, name: "Tag", type: "urn:tag:genre:place" }],
      ...extra,
    };
  }

  it("filters each excluded marker and keeps nightlife and food tags", () => {
    for (const marker of NON_TOURIST_ID_MARKERS) {
      expect(
        isNonTouristCandidate(tagged(`urn:tag:genre:place:${marker}`)),
        marker
      ).toBe(true);
      expect(
        isNonTouristCandidate(tagged(`urn:tag:category:place:${marker}`)),
        marker
      ).toBe(true);
    }
    expect(isNonTouristCandidate(tagged("urn:tag:genre:place:casino"))).toBe(false);
    expect(
      isNonTouristCandidate(tagged("urn:tag:genre:place:restaurant:karaoke_bar"))
    ).toBe(false);
    expect(isNonTouristCandidate(tagged("urn:tag:genre:place:bar"))).toBe(false);
    expect(isNonTouristCandidate(tagged("urn:tag:genre:place:comedy_club"))).toBe(false);
    expect(isNonTouristCandidate(tagged("urn:tag:genre:place:cafe"))).toBe(false);
  });

  it("does not match innsbruck tag parts or school only in the place name", () => {
    expect(isNonTouristCandidate(tagged("urn:tag:genre:place:innsbruck"))).toBe(false);
    expect(
      isNonTouristCandidate({
        name: "School of Rock Bar",
        tags: [{ id: "urn:tag:genre:place:bar", name: "Bar", type: "urn:tag:genre:place" }],
      })
    ).toBe(false);
    expect(isNonTouristCandidate({ name: "Universidad Jaime Bausate y Meza", tags: [] })).toBe(
      false
    );
  });
});

describe("ranking and Voluntrip Value Score", () => {
  const salsaNight = place({
    id: "el-social-salsa",
    name: "El Social Salsa",
    rank: 1,
    priceLevel: 3,
    tags: [
      { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
      { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
    ],
  });
  const cheaperSalsa = place({
    id: "barrio-salsa",
    name: "Barrio Salsa",
    rank: 2,
    priceLevel: 1,
    tags: [
      { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
      { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
    ],
  });
  const unmatchedPark = place({
    id: "random-park",
    name: "Random park",
    rank: 3,
    priceLevel: 1,
    tags: [{ id: "urn:tag:genre:place:park", name: "Park", type: "urn:tag:genre:place" }],
  });

  it("Qloo ON top differs from Qloo OFF baseline with the same snapshot", () => {
    const snapshotOn = buildBudgetSnapshot(trip, transactions, pockets, now);
    const snapshotOff = buildBudgetSnapshot(trip, transactions, pockets, now);
    expect(snapshotOn).toEqual(snapshotOff);

    const on = rankOn([salsaNight, cheaperSalsa, unmatchedPark]);
    const off = rankMedellinBaseline({
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });

    expect(on.best).not.toBeNull();
    expect(off.best).not.toBeNull();
    expect(on.best?.id).not.toBe(off.best?.id);
    expect(on.best?.source).toBe("qloo");
    expect(off.best?.source).toBe("demo");
    expect(off.all.every((item) => item.source === "demo")).toBe(true);
    expect(off.all.every((item) => item.culturalFit === 0)).toBe(true);
    expect(off.all.every((item) => item.whyQloo.source !== "qloo")).toBe(true);
  });

  it("gives financialFit 0 when cost exceeds real available money and never picks it as best", () => {
    const expensive = place({
      id: "pricey-club",
      name: "Pricey Club",
      rank: 1,
      priceLevel: 4,
      tags: [
        { id: SALSA, name: "Salsa", type: "urn:tag:genre:music" },
        { id: NIGHTLIFE, name: "Nightlife", type: "urn:tag:genre:place" },
      ],
    });
    const affordable = place({
      id: "cheap-cafe",
      name: "Cheap café",
      rank: 2,
      priceLevel: 1,
      tags: [{ id: "urn:tag:category:place:cafe", name: "Café", type: "urn:tag:category:place" }],
    });

    const snapshot = buildBudgetSnapshot(tightTrip, transactions, tightPockets, now);
    expect(snapshot.realAvailable).toBeLessThan(PRICE_LEVEL_USD[4]);

    const fit = financialFit(PRICE_LEVEL_USD[4], snapshot, {
      trip: tightTrip,
      transactions,
      pockets: tightPockets,
      now,
    });
    expect(fit).toBe(0);

    const ranked = rankOn([expensive, affordable], {
      trip: tightTrip,
      transactions,
      pockets: tightPockets,
    });
    expect(ranked.all.find((item) => item.id === "pricey-club")?.financialFit).toBe(0);
    expect(ranked.best?.id).not.toBe("pricey-club");
    expect(ranked.best?.id).toBe("cheap-cafe");
    expect(ranked.best?.financialFit).toBeGreaterThan(0);
  });

  it("picks a cheaper alternative with culturalFit >= 60, or null", () => {
    const withAlternative = rankOn([salsaNight, cheaperSalsa, unmatchedPark]);
    expect(withAlternative.best?.id).toBe("el-social-salsa");
    expect(withAlternative.alternative?.id).toBe("barrio-salsa");
    expect(withAlternative.alternative).not.toBeNull();
    expect(withAlternative.alternative!.estimatedCost.amount).toBeLessThan(
      withAlternative.best!.estimatedCost.amount
    );
    expect(withAlternative.alternative!.culturalFit).toBeGreaterThanOrEqual(60);

    const onlyBestFits = rankOn([salsaNight, unmatchedPark]);
    expect(onlyBestFits.best?.id).toBe("el-social-salsa");
    expect(onlyBestFits.alternative).toBeNull();
  });

  it("keeps demo/unavailable/baseline off the qloo source", () => {
    const demoRanked = rankExperiences({
      candidates: [
        place({
          id: "demo-cafe",
          name: "Demo café",
          rank: 1,
          tags: [{ id: SALSA, name: "Salsa", type: "urn:tag:genre:music" }],
        }),
      ],
      source: "demo",
      queriedAt: now.toISOString(),
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });
    expect(demoRanked.all[0]?.source).toBe("demo");
    expect(demoRanked.all[0]?.culturalFit).toBe(0);
    expect(demoRanked.all[0]?.whyQloo.source).toBe("demo");

    const unavailable = rankExperiences({
      candidates: [],
      source: "unavailable",
      queriedAt: now.toISOString(),
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });
    expect(unavailable.best).toBeNull();
    expect(unavailable.all).toEqual([]);

    const baseline = getMedellinBaseline(now);
    expect(baseline.source).toBe("demo");
    expect(baseline.label).toBe("generic, not from Qloo");
    expect(baseline.candidates.every((item) => !item.id.startsWith("urn:"))).toBe(true);
  });

  it("separates Qloo evidence from Voluntrip evidence", () => {
    const ranked = rankExperiences({
      candidates: [salsaNight],
      source: "qloo",
      queriedAt: now.toISOString(),
      qlooTotal: 10,
      signals: ["salsa", "vida nocturna"],
      profileTagIds: PROFILE_TAGS,
      intent: "tonight",
      trip,
      transactions,
      pockets,
      now,
    });
    const best = ranked.best!;
    expect(best.whyQloo).toMatchObject({
      matchedTags: expect.arrayContaining([SALSA, NIGHTLIFE]),
      rank: 1,
      source: "qloo",
      queriedAt: now.toISOString(),
      signals: ["salsa", "vida nocturna"],
      totalResults: 10,
    });
    expect(best.whyVoluntrip.estimatedCost.isEstimate).toBe(true);
    expect(best.whyVoluntrip.protectedMoneyUntouched).toBe(true);
    expect(best.whyVoluntrip.dailySafeSpendAfter).toBeLessThanOrEqual(
      best.whyVoluntrip.dailySafeSpendBefore
    );
    expect(["on_track", "careful", "at_risk"]).toContain(best.whyVoluntrip.runwayStatus);
  });
});
