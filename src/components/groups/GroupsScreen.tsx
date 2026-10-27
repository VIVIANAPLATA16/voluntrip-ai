"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { t } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";
import { isCloudConfigured } from "@/lib/supabase/client";
import {
  clearGroupSession,
  leaveSharedGroup,
  loadGroupSession,
  readSharedGroup,
} from "@/lib/groups/client";
import { groupTagLabel, groupTasteOverlap } from "@/lib/groups/overlap";
import {
  createGroupFromUi,
  groupErrorText,
  groupShareMissedLikes,
  groupShareTags,
  groupsGate,
  joinGroupFromUi,
  memberReceivedShare,
  profileForShare,
  setGroupSharing,
} from "@/lib/groups/share";
import { validateAlias, validateGroupCode } from "@/lib/groups/validate";
import type { GroupErrStatus, GroupPublic, GroupSession } from "@/lib/groups/types";

type View = "loading" | "needs_cloud" | "offline" | "idle" | "ready";

function TagChips({ ids }: { ids: string[] }) {
  const labels = ids
    .map(function (id) {
      return groupTagLabel(id);
    })
    .filter(function (label): label is string {
      return Boolean(label);
    });
  if (labels.length === 0) return null;
  return (
    <ul className="flex min-w-0 flex-wrap gap-2">
      {labels.map(function (label) {
        return (
          <li
            key={label}
            className="max-w-full break-words rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink"
          >
            {label}
          </li>
        );
      })}
    </ul>
  );
}

export function GroupsScreen() {
  const reduceMotion = useReducedMotion();
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const offline = useAppStore(function (s) {
    return s.offline;
  });
  const culturalProfile = useAppStore(function (s) {
    return s.culturalProfile;
  });

  const [view, setView] = useState("loading" as View);
  const [group, setGroup] = useState(null as GroupPublic | null);
  const [session, setSession] = useState(null as GroupSession | null);
  const [error, setError] = useState(null as GroupErrStatus | null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

  const showError = useCallback(function (status: GroupErrStatus) {
    setError(status);
  }, []);

  const refresh = useCallback(async function () {
    try {
      const gate = groupsGate({ cloud: isCloudConfigured(), offline });
      if (gate !== "ok") {
        setView(gate);
        return;
      }
      setView("loading");
      const stored = await loadGroupSession();
      setSession(stored);
      if (!stored) {
        setGroup(null);
        setView("idle");
        return;
      }
      const result = await readSharedGroup();
      if (result.status !== "ok") {
        if (result.status === "not_found") {
          await clearGroupSession();
          setGroup(null);
          setSession(null);
          setView("idle");
          return;
        }
        showError(result.status);
        setView("idle");
        return;
      }
      setGroup(result.group);
      const me = result.group.members.find(function (member) {
        return member.id === stored.memberId;
      });
      const isSharing = Boolean(me && me.tags.length > 0);
      setSharing(isSharing);
      setView("ready");
      if (!isSharing || !me) return;
      const latest = await profileForShare(culturalProfile);
      if (groupShareTags(latest).length === 0) return;
      const synced = await setGroupSharing({
        sharing: true,
        alias: me.alias,
        profile: latest,
      });
      if (synced.status !== "ok" || !synced.group) return;
      const mine = synced.group.members.find(function (member) {
        return member.id === stored.memberId;
      });
      if (memberReceivedShare(synced.sent, mine?.tags)) {
        setGroup(synced.group);
      }
    } catch {
      showError("unavailable");
      setView("idle");
    }
  }, [culturalProfile, offline, showError]);

  useEffect(function () {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    const name = validateAlias(groupName);
    const alias = validateAlias(displayName);
    if (!name.ok) {
      showError("invalid_alias");
      return;
    }
    if (!alias.ok) {
      showError("invalid_alias");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createGroupFromUi({
        groupName: name.alias,
        displayName: alias.alias,
        sharing: false,
        profile: culturalProfile,
      });
      if (result.status !== "ok") {
        showError(result.status);
        return;
      }
    } catch {
      showError("unavailable");
      return;
    } finally {
      setBusy(false);
    }
    setGroupName("");
    setDisplayName("");
    await refresh();
  }

  async function onJoin() {
    const parsedCode = validateGroupCode(code);
    const alias = validateAlias(displayName);
    if (!parsedCode.ok) {
      showError("invalid_code");
      return;
    }
    if (!alias.ok) {
      showError("invalid_alias");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await joinGroupFromUi({
        code: parsedCode.code,
        displayName: alias.alias,
        sharing: false,
        profile: culturalProfile,
      });
      if (result.status !== "ok") {
        showError(result.status);
        return;
      }
    } catch {
      showError("unavailable");
      return;
    } finally {
      setBusy(false);
    }
    setCode("");
    setDisplayName("");
    await refresh();
  }

  async function onToggleShare() {
    if (!group || !session) return;
    const me = group.members.find(function (member) {
      return member.id === session.memberId;
    });
    const next = !sharing;
    setBusy(true);
    setError(null);
    try {
      const result = await setGroupSharing({
        sharing: next,
        alias: me?.alias || displayName || group.name,
        profile: culturalProfile,
      });
      if (result.status !== "ok") {
        showError(result.status);
        return;
      }
      const mine = result.group.members.find(function (member) {
        return member.id === session.memberId;
      });
      if (next && result.sent.length === 0) {
        const latest = await profileForShare(culturalProfile);
        if (groupShareMissedLikes(latest)) {
          showError("invalid_tags");
          return;
        }
      }
      if (next && !memberReceivedShare(result.sent, mine?.tags)) {
        showError("invalid_tags");
        return;
      }
      if (!next && mine && mine.tags.length > 0) {
        showError("invalid_tags");
        return;
      }
      setSharing(next);
      setGroup(result.group);
    } catch {
      showError("unavailable");
    } finally {
      setBusy(false);
    }
  }

  async function onLeave() {
    setBusy(true);
    setError(null);
    try {
      const result = await leaveSharedGroup();
      if (result.status !== "ok" && result.status !== "not_found") {
        showError(result.status);
        return;
      }
    } catch {
      showError("unavailable");
      return;
    } finally {
      setBusy(false);
    }
    setConfirmLeave(false);
    setGroup(null);
    setSession(null);
    setSharing(false);
    setView("idle");
  }

  async function onCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(function () {
        setCopied(false);
      }, 1200);
    } catch {
      showError("unavailable");
    }
  }

  const overlap = group ? groupTasteOverlap(group.members) : null;

  return (
    <motion.div
      {...motionProps}
      className="min-w-0 max-w-full space-y-5 overflow-x-hidden pb-4 motion-reduce:transition-none"
    >
      <h1 className="font-display text-2xl font-semibold break-words">
        {t(locale, "groups.title")}
      </h1>

      {view === "loading" ? (
        <div
          className="space-y-3 motion-reduce:animate-none"
          aria-busy
          aria-label={t(locale, "groups.loading")}
        >
          <div className="h-16 animate-pulse rounded-card bg-surface motion-reduce:animate-none" />
          <div className="h-24 animate-pulse rounded-card bg-surface motion-reduce:animate-none" />
        </div>
      ) : null}

      {view === "needs_cloud" ? (
        <p className="text-sm text-ink-muted break-words">{t(locale, "groups.needs_cloud")}</p>
      ) : null}

      {view === "offline" ? (
        <p className="text-sm text-ink-muted break-words">{t(locale, "groups.offline")}</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger break-words">
          {groupErrorText(locale, error)}
        </p>
      ) : null}

      {view === "idle" ? (
        <div className="grid min-w-0 gap-4">
          <section className="min-w-0 space-y-3 rounded-card border border-border bg-surface/80 p-4">
            <h2 className="text-sm font-semibold text-ink">{t(locale, "groups.create")}</h2>
            <Input
              id="groups-create-name"
              label={t(locale, "groups.group_name")}
              value={groupName}
              maxLength={24}
              onChange={function (event) {
                setGroupName(event.target.value);
              }}
            />
            <Input
              id="groups-create-alias"
              label={t(locale, "groups.display_name")}
              value={displayName}
              maxLength={24}
              onChange={function (event) {
                setDisplayName(event.target.value);
              }}
            />
            <Button
              className="min-h-10 w-full max-w-full motion-reduce:transition-none"
              disabled={busy}
              onClick={function () {
                void onCreate();
              }}
            >
              {t(locale, "groups.create")}
            </Button>
          </section>
          <section className="min-w-0 space-y-3 rounded-card border border-border bg-surface/80 p-4">
            <h2 className="text-sm font-semibold text-ink">{t(locale, "groups.join")}</h2>
            <Input
              id="groups-join-code"
              label={t(locale, "groups.code")}
              placeholder={t(locale, "groups.code_placeholder")}
              value={code}
              maxLength={8}
              onChange={function (event) {
                setCode(event.target.value);
              }}
            />
            <Input
              id="groups-join-alias"
              label={t(locale, "groups.display_name")}
              value={displayName}
              maxLength={24}
              onChange={function (event) {
                setDisplayName(event.target.value);
              }}
            />
            <Button
              variant="secondary"
              className="min-h-10 w-full max-w-full motion-reduce:transition-none"
              disabled={busy}
              onClick={function () {
                void onJoin();
              }}
            >
              {t(locale, "groups.join")}
            </Button>
          </section>
        </div>
      ) : null}

      {view === "ready" && group && overlap ? (
        <div className="min-w-0 space-y-4">
          <section className="min-w-0 space-y-3 rounded-card border border-border bg-surface/80 p-4">
            <h2 className="font-display text-xl font-semibold break-words">{group.name}</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 break-all text-sm text-ink-muted">
                {t(locale, "groups.code")}: {group.code}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="min-h-10 motion-reduce:transition-none"
                onClick={function () {
                  void onCopy(group.code);
                }}
              >
                {copied ? t(locale, "groups.copied") : t(locale, "groups.copy")}
              </Button>
            </div>
            {group.members.length <= 1 ? (
              <p className="text-sm text-ink-muted break-words">{t(locale, "groups.empty")}</p>
            ) : null}
          </section>

          <section className="min-w-0 space-y-3 rounded-card border border-border bg-surface/80 p-4">
            <h2 className="text-sm font-semibold text-ink">{t(locale, "groups.members")}</h2>
            <ul className="space-y-2">
              {overlap.memberShares.map(function (member) {
                const countKey =
                  member.sharedCount === 1 ? "groups.shared_one" : "groups.shared_count";
                return (
                  <li key={member.id} className="min-w-0 space-y-2 break-words text-sm text-ink">
                    <div>
                      <span className="font-medium">{member.alias}</span>
                      <span className="text-ink-muted">
                        {" "}
                        · {t(locale, countKey, { count: member.sharedCount })}
                      </span>
                    </div>
                    <TagChips ids={member.tags} />
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="min-w-0 space-y-3 rounded-card border border-border bg-surface/80 p-4">
            <h2 className="text-sm font-semibold text-ink">{t(locale, "groups.in_common")}</h2>
            {overlap.common.length === 0 ? (
              <p className="text-sm text-ink-muted break-words">
                {t(locale, "groups.empty_common")}
              </p>
            ) : (
              <TagChips ids={overlap.common} />
            )}
            <h3 className="text-sm font-semibold text-ink">{t(locale, "groups.almost")}</h3>
            {overlap.almost.length === 0 ? (
              <p className="text-sm text-ink-muted break-words">
                {t(locale, "groups.empty_common")}
              </p>
            ) : (
              <TagChips ids={overlap.almost} />
            )}
          </section>

          <section className="min-w-0 space-y-3 rounded-card border border-border bg-surface/80 p-4">
            <Button
              variant={sharing ? "primary" : "secondary"}
              aria-pressed={sharing}
              className="min-h-10 h-auto w-full max-w-full whitespace-normal motion-reduce:transition-none"
              disabled={busy}
              onClick={function () {
                void onToggleShare();
              }}
            >
              {t(locale, "groups.share_toggle")}
            </Button>
            <p className="text-xs text-ink-muted break-words">{t(locale, "groups.share_hint")}</p>
          </section>

          {confirmLeave ? (
            <section className="min-w-0 space-y-3 rounded-card border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm text-ink break-words">{t(locale, "groups.leave_confirm")}</p>
              <div className="flex min-w-0 flex-wrap gap-2">
                <Button
                  variant="danger"
                  className="min-h-10 motion-reduce:transition-none"
                  disabled={busy}
                  onClick={function () {
                    void onLeave();
                  }}
                >
                  {t(locale, "groups.leave_yes")}
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-10 motion-reduce:transition-none"
                  onClick={function () {
                    setConfirmLeave(false);
                  }}
                >
                  {t(locale, "groups.leave_no")}
                </Button>
              </div>
            </section>
          ) : (
            <Button
              variant="danger"
              className="min-h-10 w-full max-w-full motion-reduce:transition-none"
              onClick={function () {
                setConfirmLeave(true);
              }}
            >
              {t(locale, "groups.leave")}
            </Button>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
