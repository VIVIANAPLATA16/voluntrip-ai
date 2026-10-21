/**
 * Catalog of Cultural DNA likes → Qloo tag IDs.
 * Only IDs listed here are known. Do not invent additional URNs.
 *
 * `mechanism: "signal"` is sent as signal.interests.tags.
 * `mechanism: "filter"` is sent as filter.tags (at most one).
 * The retired nightlife signal ID is never sent.
 */

export type CulturalDnaCategory = "music" | "food" | "entertainment" | "activities";
export type CulturalDnaMechanism = "signal" | "filter";

export interface CulturalDnaTag {
  label: string;
  qlooTagId: string;
  mechanism: CulturalDnaMechanism;
  verifiedAsSignal: boolean;
  verifiedAsFilter: boolean;
}

/** Old nightlife signal. Stored profiles may still have it; never send it to Qloo. */
export const RETIRED_NIGHTLIFE_SIGNAL_ID = "urn:tag:genre:place:nightlife";

export const CULTURAL_DNA_MAX_SIGNALS = 8;
export const CULTURAL_DNA_MAX_FILTERS = 1;

function signal(label: string, qlooTagId: string): CulturalDnaTag {
  return {
    label,
    qlooTagId,
    mechanism: "signal",
    verifiedAsSignal: true,
    verifiedAsFilter: false,
  };
}

function filter(label: string, qlooTagId: string): CulturalDnaTag {
  return {
    label,
    qlooTagId,
    mechanism: "filter",
    verifiedAsSignal: false,
    verifiedAsFilter: true,
  };
}

function unverified(label: string, qlooTagId: string): CulturalDnaTag {
  return {
    label,
    qlooTagId,
    mechanism: "signal",
    verifiedAsSignal: false,
    verifiedAsFilter: false,
  };
}

export const CULTURAL_DNA_TAG_MAP: Record<CulturalDnaCategory, CulturalDnaTag[]> = {
  music: [
    signal("salsa", "urn:tag:genre:music:salsa"),
    signal("reggaeton", "urn:tag:genre:music:reggaeton"),
    signal("rock", "urn:tag:genre:music:rock"),
    signal("jazz", "urn:tag:genre:music:jazz"),
    signal("electronic", "urn:tag:genre:music:electronic"),
    signal("hip hop", "urn:tag:genre:music:hip_hop"),
    signal("indie", "urn:tag:genre:music:indie"),
    signal("pop", "urn:tag:genre:music:pop"),
    signal("vallenato", "urn:tag:genre:music:vallenato"),
    signal("cumbia", "urn:tag:genre:music:cumbia"),
    signal("techno", "urn:tag:genre:music:techno"),
    signal("reggae", "urn:tag:genre:music:reggae"),
    filter("Classical / concert halls", "urn:tag:genre:place:concert_hall"),
  ],
  food: [
    signal("japonesa", "urn:tag:genre:place:restaurant:japanese"),
    signal("sushi", "urn:tag:genre:place:restaurant:sushi"),
    signal("vegan", "urn:tag:genre:place:restaurant:vegan"),
    signal("vegetarian", "urn:tag:genre:place:restaurant:vegetarian"),
    signal("coffee", "urn:tag:genre:place:restaurant:coffee_shop"),
    signal("craft beer", "urn:tag:specialty_dish:place:craft_beer"),
    signal("wine", "urn:tag:genre:place:restaurant:wine_bar"),
    signal("bakery", "urn:tag:genre:place:restaurant:bakery"),
    signal("italian", "urn:tag:genre:place:restaurant:italian"),
    signal("mexican", "urn:tag:genre:place:restaurant:mexican"),
    signal("colombiana", "urn:tag:genre:place:restaurant:colombian"),
    signal("seafood", "urn:tag:genre:place:restaurant:seafood"),
    signal("brunch", "urn:tag:genre:place:restaurant:brunch"),
    signal("desserts", "urn:tag:genre:place:restaurant:dessert"),
    signal("street food", "urn:tag:cuisine:qloo:street_food"),
    filter("cocktails", "urn:tag:menu_highlight:qloo:cocktails"),
    filter("Latin American food", "urn:tag:genre:place:restaurant:latin_american"),
    unverified("café", "urn:tag:category:place:coffee"),
  ],
  entertainment: [
    signal("bars", "urn:tag:genre:place:restaurant:bar"),
    signal("live music", "urn:tag:genre:place:restaurant:live_music_bar"),
    signal("museums", "urn:tag:genre:place:museum"),
    signal("art galleries", "urn:tag:genre:place:art_gallery"),
    signal("comedy", "urn:tag:genre:media:comedy"),
    signal("karaoke", "urn:tag:genre:place:restaurant:karaoke_bar"),
    signal("bookstores", "urn:tag:genre:place:book_store"),
    filter("nightlife", "urn:tag:genre:place:night_club"),
    filter("dance club", "urn:tag:genre:place:dance_club"),
    filter("theater", "urn:tag:genre:place:performing_arts_theater"),
    filter("cinema", "urn:tag:genre:place:movie_theater"),
    unverified("música en vivo", "urn:tag:good_for:qloo:live_music"),
  ],
  activities: [
    signal("markets", "urn:tag:genre:place:market"),
    signal("parks", "urn:tag:genre:place:park"),
    signal("tours", "urn:tag:genre:place:tourist_attraction"),
    signal("bike", "urn:tag:genre:place:bicycle_shop"),
    signal("shopping", "urn:tag:genre:place:shopping_mall"),
    signal("wellness", "urn:tag:genre:place:restaurant:health_food"),
    filter("rooftop", "urn:tag:setting:qloo:rooftop"),
    filter("spa", "urn:tag:category:place:spa"),
    filter("yoga", "urn:tag:genre:place:yoga_studio"),
    filter("coworking", "urn:tag:category:place:coworking_space"),
    unverified("senderismo", "urn:tag:category:place:hiking_area"),
    unverified("cafés", "urn:tag:category:place:cafe"),
  ],
};

export function allCulturalDnaTags(): CulturalDnaTag[] {
  return [
    ...CULTURAL_DNA_TAG_MAP.music,
    ...CULTURAL_DNA_TAG_MAP.food,
    ...CULTURAL_DNA_TAG_MAP.entertainment,
    ...CULTURAL_DNA_TAG_MAP.activities,
  ];
}

export function findCulturalDnaTag(id: string): CulturalDnaTag | undefined {
  const tag = id.trim();
  return allCulturalDnaTags().find((entry) => entry.qlooTagId === tag);
}

export function isRetiredSignalTagId(id: string): boolean {
  return id.trim() === RETIRED_NIGHTLIFE_SIGNAL_ID;
}

export function verifiedSignalTagIds(): string[] {
  return [
    ...new Set(
      allCulturalDnaTags()
        .filter((tag) => tag.mechanism === "signal" && tag.verifiedAsSignal)
        .map((tag) => tag.qlooTagId)
    ),
  ];
}

export function verifiedFilterTagIds(): string[] {
  return [
    ...new Set(
      allCulturalDnaTags()
        .filter((tag) => tag.mechanism === "filter" && tag.verifiedAsFilter)
        .map((tag) => tag.qlooTagId)
    ),
  ];
}

/**
 * Tag IDs safe to send as Qloo signals: present on the consented profile
 * and verified in this catalog. Never invents IDs. Ignores the retired nightlife signal.
 */
export function toQlooSignalTags(profileTagIds: readonly string[]): string[] {
  const verified = new Set(verifiedSignalTagIds());
  const seen = new Set<string>();
  const signals: string[] = [];
  for (const id of profileTagIds) {
    const tag = id.trim();
    if (!tag || seen.has(tag) || isRetiredSignalTagId(tag) || !verified.has(tag)) continue;
    seen.add(tag);
    signals.push(tag);
  }
  return signals;
}

export function toQlooFilterTagId(profileTagIds: readonly string[]): string | undefined {
  const verified = new Set(verifiedFilterTagIds());
  for (const id of profileTagIds) {
    const tag = id.trim();
    if (tag && verified.has(tag) && !isRetiredSignalTagId(tag)) return tag;
  }
  return undefined;
}
