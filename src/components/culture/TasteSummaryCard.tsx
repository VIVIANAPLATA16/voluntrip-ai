"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { CulturalProfile } from "@/types";
import { t, type Locale, type TranslationKey } from "@/lib/i18n/dictionaries";
import { useAppStore } from "@/store/appStore";

export const TASTE_PROFILE_PATH = "/app/profile";

/** Sections the /app/profile page hosts via CulturalDnaCard. */
export const TASTE_PROFILE_SECTIONS = [
  "consent",
  "signals",
  "filter",
  "lovedEntities",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TasteSummaryModel = {
  href: typeof TASTE_PROFILE_PATH;
  empty: boolean;
  consentGranted: boolean;
  likeCount: number;
  entityNames: string[];
};

export function likedTasteCount(profile: CulturalProfile | null | undefined): number {
  if (!profile) return 0;
  return (
    profile.music.length +
    profile.food.length +
    profile.entertainment.length +
    profile.activities.length
  );
}

/** Names only. Drops blanks, duplicates, and raw UUIDs. Never invents a label. */
export function lovedEntityNames(
  entities: CulturalProfile["lovedEntities"] | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entity of entities ?? []) {
    const name = String(entity?.name ?? "").trim();
    if (!name || UUID_RE.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function buildTasteSummary(
  profile: CulturalProfile | null | undefined
): TasteSummaryModel {
  const likeCount = likedTasteCount(profile);
  const entityNames = lovedEntityNames(profile?.lovedEntities);
  const consentGranted = Boolean(profile?.consent.granted);
  const empty = !consentGranted && likeCount === 0 && entityNames.length === 0;
  return {
    href: TASTE_PROFILE_PATH,
    empty,
    consentGranted,
    likeCount,
    entityNames,
  };
}

export function likesCountKey(count: number): TranslationKey {
  return count === 1 ? "taste.summary.likes_one" : "taste.summary.likes_other";
}

export function tasteProfileAvatarProps(locale: Locale): {
  href: typeof TASTE_PROFILE_PATH;
  "aria-label": string;
} {
  return {
    href: TASTE_PROFILE_PATH,
    "aria-label": t(locale, "profile.taste_title"),
  };
}

export function TasteProfileAvatarLink({ children }: { children: ReactNode }) {
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const props = tasteProfileAvatarProps(locale);
  return (
    <Link
      href={props.href}
      aria-label={props["aria-label"]}
      className="relative inline-flex items-center justify-center min-h-11 min-w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
    >
      {children}
      <Heart
        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-accent fill-accent"
        aria-hidden
      />
    </Link>
  );
}

export function TasteSummaryCard() {
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const profile = useAppStore(function (s) {
    return s.culturalProfile;
  });
  const summary = buildTasteSummary(profile);
  const consentLabel = summary.consentGranted
    ? t(locale, "culture.consent_on")
    : t(locale, "culture.consent_off");

  return (
    <section className="min-w-0 max-w-full overflow-x-hidden rounded-card border border-border bg-surface/80 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-ink break-words">
        {t(locale, "taste.summary.title")}
      </h2>
      {summary.empty ? (
        <p className="text-sm text-ink-muted break-words">
          {t(locale, "taste.summary.empty")}
        </p>
      ) : (
        <div className="space-y-1 text-sm text-ink-muted break-words">
          <p>
            {t(locale, "taste.summary.consent", { status: consentLabel })}
          </p>
          <p>
            {t(locale, likesCountKey(summary.likeCount), { count: summary.likeCount })}
          </p>
          {summary.entityNames.length > 0 ? (
            <p>
              {t(locale, "taste.summary.loves", {
                names: summary.entityNames.join(", "),
              })}
            </p>
          ) : null}
        </div>
      )}
      <Link
        href={summary.href}
        className="inline-flex items-center justify-center min-h-10 h-10 px-4 rounded-xl text-sm font-semibold bg-accent text-bg touch-target break-words motion-reduce:transition-none"
      >
        {t(locale, "taste.summary.edit")}
      </Link>
    </section>
  );
}
