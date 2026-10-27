import type { TranslationKey } from "@/lib/i18n/dictionaries";

export type TastePrivacyAction = "start" | "stop";

export type MemberTasteStatus = "private" | "no_match" | "matched";

export type TastePrivacyView = {
  statusKey: TranslationKey;
  bodyKey: TranslationKey;
  actionKey: TranslationKey;
  action: TastePrivacyAction;
};

/** Copy keys for the local member's privacy card. Does not change share payloads. */
export function tastePrivacyView(sharing: boolean): TastePrivacyView {
  if (sharing) {
    return {
      statusKey: "groups.privacy.sharing",
      bodyKey: "groups.privacy.sharing_body",
      actionKey: "groups.privacy.stop",
      action: "stop",
    };
  }
  return {
    statusKey: "groups.privacy.private",
    bodyKey: "groups.privacy.private_body",
    actionKey: "groups.privacy.share",
    action: "start",
  };
}

/**
 * Sharing is inferred from tags already stored on the member.
 * Empty tags cannot be distinguished from "sharing with no likes"; that is the existing contract.
 */
export function memberTasteStatus(member: {
  tags: readonly string[];
  sharedCount: number;
}): MemberTasteStatus {
  if (member.tags.length === 0) return "private";
  if (member.sharedCount === 0) return "no_match";
  return "matched";
}

export function sharingMemberCount(members: readonly { tags: readonly string[] }[]): number {
  return members.filter(function (member) {
    return member.tags.length > 0;
  }).length;
}

/** Empty overlap copy. Never returns an empty key when the section already has matches. */
export function overlapSectionEmptyKey(
  ids: readonly string[],
  sharingCount: number
): TranslationKey | null {
  if (ids.length > 0) return null;
  if (sharingCount >= 1) return "groups.privacy.no_matches";
  return "groups.empty_common";
}

export type PrivacyUi = {
  sharing: boolean;
  confirmStop: boolean;
  notice: "stopped" | null;
};

/** Canceling the stop dialog must not change sharing. */
export function cancelStopShare(prev: PrivacyUi): PrivacyUi {
  return { ...prev, confirmStop: false, notice: null };
}

export function openStopShare(prev: PrivacyUi): PrivacyUi {
  if (!prev.sharing) return prev;
  return { ...prev, confirmStop: true, notice: null };
}

/**
 * Apply a share/stop server result. Failed or unverified updates keep the previous sharing flag
 * and never emit a success notice.
 */
export function applyShareResult(
  prev: PrivacyUi,
  intent: TastePrivacyAction,
  input: { ok: boolean; tagsCleared?: boolean; tagsReceived?: boolean }
): PrivacyUi {
  if (!input.ok) {
    return {
      sharing: prev.sharing,
      confirmStop: intent === "stop" ? prev.confirmStop : false,
      notice: null,
    };
  }
  if (intent === "stop") {
    if (input.tagsCleared === false) {
      return { sharing: true, confirmStop: true, notice: null };
    }
    return { sharing: false, confirmStop: false, notice: "stopped" };
  }
  if (input.tagsReceived === false) {
    return { sharing: false, confirmStop: false, notice: null };
  }
  return { sharing: true, confirmStop: false, notice: null };
}
