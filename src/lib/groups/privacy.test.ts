import { describe, expect, it } from "vitest";
import { TASTE_PROFILE_PATH } from "@/components/culture/TasteSummaryCard";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { groupTasteOverlap } from "./overlap";
import {
  applyShareResult,
  cancelStopShare,
  GROUPS_TASTE_PROFILE_HREF,
  memberTasteChipsVisible,
  memberTasteListItem,
  memberTasteStatus,
  openStopShare,
  overlapSectionEmptyKey,
  sharingMemberCount,
  tastePrivacyView,
  tasteProfileSetup,
} from "./privacy";

const ROCK = "urn:tag:genre:music:rock";
const JAPANESE = "urn:tag:genre:place:restaurant:japanese";

const LOCALES: Locale[] = ["en", "es", "pt"];

const PRIVACY_KEYS = [
  "groups.privacy.title",
  "groups.privacy.private",
  "groups.privacy.private_body",
  "groups.privacy.sharing",
  "groups.privacy.sharing_body",
  "groups.privacy.share",
  "groups.privacy.stop",
  "groups.privacy.stop_title",
  "groups.privacy.stop_body",
  "groups.privacy.stop_cancel",
  "groups.privacy.stop_confirm",
  "groups.privacy.stopped",
  "groups.privacy.not_sharing",
  "groups.privacy.no_matches",
  "groups.privacy.setup_body",
  "groups.privacy.setup",
] as const;

describe("taste privacy copy", () => {
  it("uses the private card and share action when the member is not sharing", () => {
    const view = tastePrivacyView(false);
    expect(view.action).toBe("start");
    expect(view.actionKey).toBe("groups.privacy.share");
    expect(t("es", view.statusKey)).toBe("Privados");
    expect(t("es", view.actionKey)).toBe("Compartir mis gustos con el grupo");
    expect(t("en", view.statusKey)).toBe("Private");
    expect(t("en", view.actionKey)).toBe("Share my tastes with the group");
    expect(t("pt", view.statusKey)).toBe("Privados");
    expect(t("pt", view.actionKey)).toBe("Compartilhar meus gostos com o grupo");
  });

  it("uses the sharing card and stop action when the member is sharing", () => {
    const view = tastePrivacyView(true);
    expect(view.action).toBe("stop");
    expect(view.actionKey).toBe("groups.privacy.stop");
    expect(t("es", view.statusKey)).toBe("Compartiendo con el grupo");
    expect(t("es", view.actionKey)).toBe("Dejar de compartir mis gustos");
    expect(t("en", view.statusKey)).toBe("Sharing with the group");
    expect(t("en", view.actionKey)).toBe("Stop sharing my tastes");
    expect(t("pt", view.statusKey)).toBe("Compartilhando com o grupo");
    expect(t("pt", view.actionKey)).toBe("Parar de compartilhar meus gostos");
  });

  it("has natural copy for the new privacy keys in en, es, and pt", () => {
    for (const locale of LOCALES) {
      for (const key of PRIVACY_KEYS) {
        const text = t(locale, key);
        expect(text).not.toBe(key);
        expect(text.length).toBeGreaterThan(1);
      }
    }
    expect(t("es", "groups.privacy.title")).toBe("Tus gustos culturales");
    expect(t("en", "groups.privacy.title")).toBe("Your cultural tastes");
    expect(t("pt", "groups.privacy.title")).toBe("Seus gostos culturais");
    expect(t("es", "groups.privacy.not_sharing")).toBe("No comparte sus gustos");
    expect(t("en", "groups.privacy.not_sharing")).toBe("Not sharing their tastes");
    expect(t("pt", "groups.privacy.no_matches")).toBe("Ainda não há interesses em comum");
    expect(t("es", "groups.privacy.setup")).toBe("Configurar mis gustos culturales");
    expect(t("en", "groups.privacy.setup")).toBe("Set up my cultural tastes");
    expect(t("pt", "groups.privacy.setup")).toBe("Configurar meus gostos culturais");
  });
});

describe("privacy confirmations and errors", () => {
  const sharing = { sharing: true, confirmStop: false, notice: null as const };

  it("canceling stop-share confirmation does not change sharing", () => {
    const confirming = openStopShare(sharing);
    expect(confirming.confirmStop).toBe(true);
    expect(confirming.sharing).toBe(true);
    const cancelled = cancelStopShare(confirming);
    expect(cancelled).toEqual({ sharing: true, confirmStop: false, notice: null });
  });

  it("confirming stop-share only after the server cleared tags", () => {
    const stopped = applyShareResult(sharing, "stop", { ok: true, tagsCleared: true });
    expect(stopped).toEqual({ sharing: false, confirmStop: false, notice: "stopped" });
    expect(t("es", "groups.privacy.stopped")).toBe(
      "Tus gustos ya no se comparten con el grupo"
    );
  });

  it("does not show a success notice when stop-share fails or tags remain", () => {
    const confirming = { sharing: true, confirmStop: true, notice: null as const };
    expect(applyShareResult(confirming, "stop", { ok: false })).toEqual({
      sharing: true,
      confirmStop: true,
      notice: null,
    });
    expect(
      applyShareResult(confirming, "stop", {
        ok: true,
        tagsCleared: false,
      })
    ).toEqual({ sharing: true, confirmStop: true, notice: null });
  });

  it("does not mark sharing on when start-share did not persist tags", () => {
    const prev = { sharing: false, confirmStop: false, notice: null as const };
    expect(applyShareResult(prev, "start", { ok: true, tagsReceived: false })).toEqual({
      sharing: false,
      confirmStop: false,
      notice: null,
    });
    expect(applyShareResult(prev, "start", { ok: false })).toEqual(prev);
  });
});

describe("member and overlap empty states", () => {
  it("distinguishes private members from sharing members with no matches", () => {
    expect(memberTasteStatus({ tags: [], sharedCount: 0 })).toBe("private");
    expect(memberTasteStatus({ tags: [ROCK], sharedCount: 0 })).toBe("no_match");
    expect(memberTasteStatus({ tags: [ROCK], sharedCount: 1 })).toBe("matched");
  });

  it("hides chips for private members and shows shared tags even without overlap", () => {
    expect(memberTasteChipsVisible([])).toBe(false);
    expect(memberTasteListItem({ tags: [], sharedCount: 0 })).toEqual({
      status: "private",
      statusKey: "groups.privacy.not_sharing",
      showChips: false,
    });
    expect(memberTasteListItem({ tags: [ROCK], sharedCount: 0 })).toEqual({
      status: "no_match",
      statusKey: "groups.privacy.no_matches",
      showChips: true,
    });
    expect(memberTasteListItem({ tags: [ROCK], sharedCount: 1 })).toEqual({
      status: "matched",
      statusKey: "groups.shared_one",
      showChips: true,
    });
    expect(memberTasteListItem({ tags: [ROCK, JAPANESE], sharedCount: 2 })).toEqual({
      status: "matched",
      statusKey: "groups.shared_count",
      showChips: true,
    });
    expect(t("es", "groups.privacy.not_sharing")).not.toBe(t("es", "groups.privacy.no_matches"));
    expect(t("en", "groups.privacy.not_sharing")).not.toBe(t("en", "groups.privacy.no_matches"));
    expect(t("pt", "groups.privacy.not_sharing")).not.toBe(t("pt", "groups.privacy.no_matches"));
  });

  it("keeps En común empty while still listing a member's shared tags", () => {
    const overlap = groupTasteOverlap([
      { id: "a", alias: "Ana", tags: [ROCK] },
      { id: "b", alias: "Bo", tags: [] },
    ]);
    expect(overlap.common).toEqual([]);
    expect(overlap.almost).toEqual([]);
    expect(memberTasteListItem(overlap.memberShares[0]).showChips).toBe(true);
    expect(memberTasteListItem(overlap.memberShares[1]).showChips).toBe(false);
    expect(
      overlapSectionEmptyKey(overlap.common, sharingMemberCount(overlap.memberShares))
    ).toBe("groups.privacy.no_matches");
  });

  it("does not show the empty-common copy when a section already has matches", () => {
    expect(overlapSectionEmptyKey([ROCK], 2)).toBeNull();
    expect(overlapSectionEmptyKey([], 0)).toBe("groups.empty_common");
    expect(overlapSectionEmptyKey([], 1)).toBe("groups.privacy.no_matches");
    expect(sharingMemberCount([{ tags: [] }, { tags: ["x"] }])).toBe(1);
  });
});

describe("taste profile setup link", () => {
  it("links to /app/profile when there are no shareable tastes and does not change sharing", () => {
    const empty = tasteProfileSetup(0);
    expect(empty.show).toBe(true);
    expect(empty.href).toBe("/app/profile");
    expect(empty.href).toBe(TASTE_PROFILE_PATH);
    expect(empty.href).toBe(GROUPS_TASTE_PROFILE_HREF);
    expect(empty.bodyKey).toBe("groups.privacy.setup_body");
    expect(empty.actionKey).toBe("groups.privacy.setup");
    expect(tastePrivacyView(false).action).toBe("start");
    expect(tastePrivacyView(true).action).toBe("stop");
  });

  it("hides the profile setup link when the local profile already has shareable tastes", () => {
    expect(tasteProfileSetup(1).show).toBe(false);
    expect(tasteProfileSetup(3).href).toBe(TASTE_PROFILE_PATH);
  });
});
