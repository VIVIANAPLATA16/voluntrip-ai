import { describe, expect, it } from "vitest";
import {
  CULTURAL_DNA_TAG_MAP,
  allCulturalDnaTags,
  toQlooSignalTags,
  verifiedSignalTagIds,
} from "./tagMap";

describe("Cultural DNA → Qloo tag catalog", () => {
  it("contains only the verified mapping (no invented URNs)", () => {
    expect(CULTURAL_DNA_TAG_MAP).toEqual({
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
    });
  });

  it("sends only verified catalog IDs as Qloo signals", () => {
    expect(verifiedSignalTagIds().sort()).toEqual(
      [
        "urn:tag:genre:music:salsa",
        "urn:tag:genre:place:restaurant:japanese",
        "urn:tag:genre:place:nightlife",
      ].sort()
    );

    expect(
      toQlooSignalTags([
        "urn:tag:genre:music:salsa",
        "urn:tag:category:place:hiking_area",
        "urn:tag:invented:not-real",
      ])
    ).toEqual(["urn:tag:genre:music:salsa"]);
  });

  it("does not include the rejected hiking URN", () => {
    expect(allCulturalDnaTags().map((tag) => tag.qlooTagId)).not.toContain(
      "urn:tag:activities:place:hiking"
    );
  });
});
