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

/** Shared tagMap ids are visible whenever the member sent any. Overlap is separate. */
export function memberTasteChipsVisible(tags: readonly string[]): boolean {
  return tags.length > 0;
}

export function memberTasteStatusKey(
  status: MemberTasteStatus,
  sharedCount: number
): TranslationKey {
  if (status === "private") return "groups.privacy.not_sharing";
  if (status === "no_match") return "groups.privacy.no_matches";
  return sharedCount === 1 ? "groups.shared_one" : "groups.shared_count";
}

export type MemberTasteListItem = {
  status: MemberTasteStatus;
  statusKey: TranslationKey;
  showChips: boolean;
};

export function memberTasteListItem(member: {
  tags: readonly string[];
  sharedCount: number;
}): MemberTasteListItem {
  const status = memberTasteStatus(member);
  return {
    status,
    statusKey: memberTasteStatusKey(status, member.sharedCount),
    showChips: memberTasteChipsVisible(member.tags),
  };
}

export const GROUPS_TASTE_PROFILE_HREF = "/app/profile" as const;

/**
 * Empty Cultural DNA is a setup gap, not a privacy change.
 * Never toggles sharing or builds a share payload.
 */
export function tasteProfileSetup(shareableTagCount: number): {
  show: boolean;
  href: typeof GROUPS_TASTE_PROFILE_HREF;
  bodyKey: TranslationKey;
  actionKey: TranslationKey;
} {
  return {
    show: shareableTagCount === 0,
    href: GROUPS_TASTE_PROFILE_HREF,
    bodyKey: "groups.privacy.setup_body",
    actionKey: "groups.privacy.setup",
  };
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
