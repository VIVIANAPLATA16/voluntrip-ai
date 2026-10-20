"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  CULTURAL_DNA_TAG_MAP,
  type CulturalDnaCategory,
  type CulturalDnaTag,
} from "@/lib/culture/tagMap";
import { emptyCulturalProfile } from "@/lib/culture/profile";
import { t, type TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import type { CulturalLike, CulturalProfile } from "@/types";

const CATEGORIES: CulturalDnaCategory[] = ["music", "food", "entertainment", "activities"];

const CATEGORY_KEYS: Record<CulturalDnaCategory, TranslationKey> = {
  music: "culture.music",
  food: "culture.food",
  entertainment: "culture.entertainment",
  activities: "culture.activities",
};

const LIKE_KEYS: Record<string, TranslationKey> = {
  salsa: "culture.like.salsa",
  japonesa: "culture.like.japonesa",
  "vida nocturna": "culture.like.vida_nocturna",
};

function verifiedTags(category: CulturalDnaCategory): CulturalDnaTag[] {
  return CULTURAL_DNA_TAG_MAP[category].filter((tag) => tag.verifiedAsSignal);
}

function isSelected(likes: CulturalLike[], tag: CulturalDnaTag): boolean {
  return likes.some((like) => like.qlooTagId === tag.qlooTagId);
}

function toggleLike(likes: CulturalLike[], tag: CulturalDnaTag): CulturalLike[] {
  if (isSelected(likes, tag)) {
    return likes.filter((like) => like.qlooTagId !== tag.qlooTagId);
  }
  return [...likes, { label: tag.label, qlooTagId: tag.qlooTagId }];
}

function keepHiddenLikes(likes: CulturalLike[], category: CulturalDnaCategory): CulturalLike[] {
  const verifiedIds = new Set(verifiedTags(category).map((tag) => tag.qlooTagId));
  return likes.filter((like) => like.qlooTagId && !verifiedIds.has(like.qlooTagId));
}

export function CulturalDnaCard() {
  const locale = useAppStore((s) => s.locale);
  const stored = useAppStore((s) => s.culturalProfile);
  const save = useAppStore((s) => s.saveCulturalProfile);
  const profile = stored ?? emptyCulturalProfile();
  const granted = profile.consent.granted;

  const persist = async (next: CulturalProfile) => {
    await save(next);
  };

  const setConsent = async (on: boolean) => {
    const now = new Date().toISOString();
    await persist({
      ...profile,
      consent: {
        granted: on,
        grantedAt: on ? profile.consent.grantedAt ?? now : null,
      },
      updatedAt: now,
    });
  };

  const setCategory = async (category: CulturalDnaCategory, likes: CulturalLike[]) => {
    const now = new Date().toISOString();
    await persist({
      ...profile,
      [category]: [...likes, ...keepHiddenLikes(profile[category], category)],
      updatedAt: now,
    });
  };

  return (
    <Card className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink break-words">{t(locale, "culture.title")}</h2>
        <p className="mt-1 text-xs text-ink-muted break-words">{t(locale, "culture.consent_hint")}</p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs text-ink-faint">{t(locale, "culture.consent")}</span>
        <Button
          type="button"
          size="sm"
          variant={granted ? "primary" : "outline"}
          className="h-9 px-3"
          aria-pressed={granted}
          onClick={() => void setConsent(!granted)}
        >
          {granted ? t(locale, "culture.consent_on") : t(locale, "culture.consent_off")}
        </Button>
      </div>

      {CATEGORIES.map((category) => {
        const options = verifiedTags(category);
        if (options.length === 0) return null;
        return (
          <div key={category} className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t(locale, CATEGORY_KEYS[category])}
            </p>
            <div className="flex min-w-0 flex-wrap gap-2">
              {options.map((tag) => {
                const selected = isSelected(profile[category], tag);
                const labelKey = LIKE_KEYS[tag.label];
                return (
                  <button
                    key={`${category}-${tag.qlooTagId}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => void setCategory(category, toggleLike(profile[category], tag))}
                    className={cn(
                      "max-w-full break-words rounded-full border px-3 py-1.5 text-xs font-semibold",
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-ink-muted"
                    )}
                  >
                    {labelKey ? t(locale, labelKey) : tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
