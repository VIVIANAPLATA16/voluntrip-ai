import { describe, expect, it } from "vitest";
import {
  CULTURAL_DNA_TAG_MAP,
  RETIRED_NIGHTLIFE_SIGNAL_ID,
  allCulturalDnaTags,
  findCulturalDnaTag,
  toQlooSignalTags,
  verifiedFilterTagIds,
  verifiedSignalTagIds,
} from "./tagMap";

describe("Cultural DNA → Qloo tag catalog", () => {
  it("marks salsa and japanese as signal and nightlife as filter", () => {
    expect(findCulturalDnaTag("urn:tag:genre:music:salsa")).toMatchObject({
      mechanism: "signal",
      verifiedAsSignal: true,
    });
    expect(findCulturalDnaTag("urn:tag:genre:place:restaurant:japanese")).toMatchObject({
      mechanism: "signal",
      verifiedAsSignal: true,
    });
    expect(findCulturalDnaTag("urn:tag:genre:place:night_club")).toMatchObject({
      mechanism: "filter",
      verifiedAsFilter: true,
    });
  });

  it("ignores the retired nightlife signal id", () => {
    expect(verifiedSignalTagIds()).not.toContain(RETIRED_NIGHTLIFE_SIGNAL_ID);
    expect(
      toQlooSignalTags([
        "urn:tag:genre:music:salsa",
        RETIRED_NIGHTLIFE_SIGNAL_ID,
        "urn:tag:genre:place:night_club",
      ])
    ).toEqual(["urn:tag:genre:music:salsa"]);
    expect(
      CULTURAL_DNA_TAG_MAP.entertainment.some(
        (tag) => tag.qlooTagId === RETIRED_NIGHTLIFE_SIGNAL_ID && tag.verifiedAsSignal
      )
    ).toBe(false);
  });

  it("does not include the rejected hiking URN", () => {
    expect(allCulturalDnaTags().map((tag) => tag.qlooTagId)).not.toContain(
      "urn:tag:activities:place:hiking"
    );
  });

  it("keeps filter ids out of the signal list", () => {
    expect(verifiedSignalTagIds()).not.toEqual(expect.arrayContaining(verifiedFilterTagIds()));
  });
});
