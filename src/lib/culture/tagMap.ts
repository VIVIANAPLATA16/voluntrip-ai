/**
 * Catalog of Cultural DNA likes → Qloo tag IDs.
 * Only IDs listed here are known. Do not invent additional URNs.
 *
 * `verifiedAsSignal` means the ID was confirmed as a working
 * `signal.interests.tags` value. Unverified IDs may be stored on a like
 * but must not be sent as Qloo signals.
 */

export type CulturalDnaCategory = "music" | "food" | "entertainment" | "activities";

export interface CulturalDnaTag {
  label: string;
  qlooTagId: string;
  verifiedAsSignal: boolean;
}

export const CULTURAL_DNA_TAG_MAP: Record<CulturalDnaCategory, CulturalDnaTag[]> = {
  music: [
    { label: "salsa", qlooTagId: "urn:tag:genre:music:salsa", verifiedAsSignal: true },
    { label: "reggaeton", qlooTagId: "urn:tag:genre:music:reggaeton", verifiedAsSignal: false },
    { label: "electronic", qlooTagId: "urn:tag:genre:music:electronic", verifiedAsSignal: false },
  ],
  food: [
    {
      label: "japonesa",
      qlooTagId: "urn:tag:genre:place:restaurant:japanese",
      verifiedAsSignal: true,
    },
    {
      label: "colombiana",
      qlooTagId: "urn:tag:genre:place:restaurant:colombian",
      verifiedAsSignal: false,
    },
    { label: "café", qlooTagId: "urn:tag:category:place:coffee", verifiedAsSignal: false },
  ],
  entertainment: [
    {
      label: "música en vivo",
      qlooTagId: "urn:tag:good_for:qloo:live_music",
      verifiedAsSignal: false,
    },
    {
      label: "vida nocturna",
      qlooTagId: "urn:tag:genre:place:nightlife",
      verifiedAsSignal: true,
    },
  ],
  activities: [
    {
      label: "senderismo",
      // NOT verified: urn:tag:activities:place:hiking returned Qloo's default list.
      qlooTagId: "urn:tag:category:place:hiking_area",
      verifiedAsSignal: false,
    },
    {
      label: "vida nocturna",
      qlooTagId: "urn:tag:genre:place:nightlife",
      verifiedAsSignal: true,
    },
    { label: "cafés", qlooTagId: "urn:tag:category:place:cafe", verifiedAsSignal: false },
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

export function verifiedSignalTagIds(): string[] {
  return [...new Set(allCulturalDnaTags().filter((tag) => tag.verifiedAsSignal).map((tag) => tag.qlooTagId))];
}

/**
 * Tag IDs safe to send as Qloo signals: present on the consented profile
 * and verified in this catalog. Never invents IDs.
 */
export function toQlooSignalTags(profileTagIds: readonly string[]): string[] {
  const verified = new Set(verifiedSignalTagIds());
  const seen = new Set<string>();
  const signals: string[] = [];
  for (const id of profileTagIds) {
    const tag = id.trim();
    if (!tag || seen.has(tag) || !verified.has(tag)) continue;
    seen.add(tag);
    signals.push(tag);
  }
  return signals;
}
