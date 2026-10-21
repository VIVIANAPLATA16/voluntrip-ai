"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  CULTURAL_DNA_MAX_SIGNALS,
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
  reggaeton: "culture.like.reggaeton",
  rock: "culture.like.rock",
  jazz: "culture.like.jazz",
  electronic: "culture.like.electronic",
  "hip hop": "culture.like.hip_hop",
  indie: "culture.like.indie",
  pop: "culture.like.pop",
  vallenato: "culture.like.vallenato",
  cumbia: "culture.like.cumbia",
  techno: "culture.like.techno",
  reggae: "culture.like.reggae",
  "Classical / concert halls": "culture.like.classical",
  japonesa: "culture.like.japonesa",
  sushi: "culture.like.sushi",
  vegan: "culture.like.vegan",
  vegetarian: "culture.like.vegetarian",
  coffee: "culture.like.coffee",
  "craft beer": "culture.like.craft_beer",
  wine: "culture.like.wine",
  bakery: "culture.like.bakery",
  italian: "culture.like.italian",
  mexican: "culture.like.mexican",
  colombiana: "culture.like.colombiana",
  seafood: "culture.like.seafood",
  brunch: "culture.like.brunch",
  desserts: "culture.like.desserts",
  "street food": "culture.like.street_food",
  cocktails: "culture.like.cocktails",
  "Latin American food": "culture.like.latin_american",
  bars: "culture.like.bars",
  "live music": "culture.like.live_music",
  museums: "culture.like.museums",
  "art galleries": "culture.like.art_galleries",
  comedy: "culture.like.comedy",
  karaoke: "culture.like.karaoke",
  bookstores: "culture.like.bookstores",
  nightlife: "culture.like.nightlife",
  "dance club": "culture.like.dance_club",
  theater: "culture.like.theater",
  cinema: "culture.like.cinema",
  markets: "culture.like.markets",
  parks: "culture.like.parks",
  tours: "culture.like.tours",
  bike: "culture.like.bike",
  shopping: "culture.like.shopping",
  wellness: "culture.like.wellness",
  rooftop: "culture.like.rooftop",
  spa: "culture.like.spa",
  yoga: "culture.like.yoga",
  coworking: "culture.like.coworking",
};

function verifiedTags(category: CulturalDnaCategory): CulturalDnaTag[] {
  return CULTURAL_DNA_TAG_MAP[category].filter(
    (tag) => tag.verifiedAsSignal || tag.verifiedAsFilter
  );
}

function allVerifiedTags(): CulturalDnaTag[] {
  return CATEGORIES.flatMap(verifiedTags);
}

function isSelected(likes: CulturalLike[], tag: CulturalDnaTag): boolean {
  return likes.some((like) => like.qlooTagId === tag.qlooTagId);
}

function selectedSignalCount(profile: CulturalProfile): number {
  const signalIds = new Set(
    allVerifiedTags()
      .filter((tag) => tag.mechanism === "signal")
      .map((tag) => tag.qlooTagId)
  );
  return CATEGORIES.reduce((count, category) => {
    return (
      count +
      profile[category].filter((like) => like.qlooTagId && signalIds.has(like.qlooTagId)).length
    );
  }, 0);
}

function withoutFilterLikes(likes: CulturalLike[]): CulturalLike[] {
  const filterIds = new Set(
    allVerifiedTags()
      .filter((tag) => tag.mechanism === "filter")
      .map((tag) => tag.qlooTagId)
  );
  return likes.filter((like) => !like.qlooTagId || !filterIds.has(like.qlooTagId));
}

function toggleLike(
  profile: CulturalProfile,
  category: CulturalDnaCategory,
  tag: CulturalDnaTag
): CulturalProfile {
  const selected = isSelected(profile[category], tag);
  if (selected) {
    return {
      ...profile,
      [category]: profile[category].filter((like) => like.qlooTagId !== tag.qlooTagId),
    };
  }

  if (tag.mechanism === "filter") {
    const next = { ...profile };
    for (const cat of CATEGORIES) {
      next[cat] = withoutFilterLikes(profile[cat]);
    }
    next[category] = [
      ...withoutFilterLikes(profile[category]),
      { label: tag.label, qlooTagId: tag.qlooTagId },
    ];
    return next;
  }

  return {
    ...profile,
    [category]: [...profile[category], { label: tag.label, qlooTagId: tag.qlooTagId }],
  };
}

export function CulturalDnaCard() {
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const stored = useAppStore(function (s) {
    return s.culturalProfile;
  });
  const save = useAppStore(function (s) {
    return s.saveCulturalProfile;
  });
  const profile = stored ?? emptyCulturalProfile();
  const granted = profile.consent.granted;
  const signalCount = selectedSignalCount(profile);
  const atSignalLimit = signalCount >= CULTURAL_DNA_MAX_SIGNALS;

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

  const onToggle = async (category: CulturalDnaCategory, tag: CulturalDnaTag) => {
    const now = new Date().toISOString();
    const toggled = toggleLike(profile, category, tag);
    await persist({ ...toggled, updatedAt: now });
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

      {atSignalLimit ? (
        <p className="text-xs text-ink-faint break-words">{t(locale, "culture.signal_limit")}</p>
      ) : null}

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
                const isFilter = tag.mechanism === "filter";
                const disabled = !selected && !isFilter && atSignalLimit;
                return (
                  <button
                    key={`${category}-${tag.qlooTagId}`}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => void onToggle(category, tag)}
                    className={cn(
                      "max-w-full break-words rounded-full border px-3 py-1.5 text-xs font-semibold",
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-ink-muted",
                      isFilter && "border-dashed",
                      disabled && "opacity-40"
                    )}
                  >
                    {labelKey ? t(locale, labelKey) : tag.label}
                    {isFilter ? (
                      <span className="ml-1 font-medium text-ink-faint">
                        {t(locale, "culture.filter_badge")}
                      </span>
                    ) : null}
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
