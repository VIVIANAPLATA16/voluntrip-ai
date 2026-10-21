"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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

function likeLabel(locale: "en" | "es" | "pt", tag: CulturalDnaTag): string {
  const key = LIKE_KEYS[tag.label];
  return key ? t(locale, key) : tag.label;
}

function selectedEntries(profile: CulturalProfile) {
  const entries: Array<{ category: CulturalDnaCategory; tag: CulturalDnaTag }> = [];
  for (const category of CATEGORIES) {
    for (const tag of verifiedTags(category)) {
      if (isSelected(profile[category], tag)) entries.push({ category, tag });
    }
  }
  return entries;
}

function initialOpen(profile: CulturalProfile): Record<CulturalDnaCategory, boolean> {
  const open = {} as Record<CulturalDnaCategory, boolean>;
  CATEGORIES.forEach(function (category, index) {
    const hasSelection = verifiedTags(category).some(function (tag) {
      return tag.mechanism === "signal" && isSelected(profile[category], tag);
    });
    open[category] = index === 0 || hasSelection;
  });
  return open;
}

export function CulturalDnaCard() {
  const reduceMotion = useReducedMotion();
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
  const chosen = selectedEntries(profile);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(function () {
    return initialOpen(profile);
  });
  const [shakeId, setShakeId] = useState("");
  const [showLimit, setShowLimit] = useState(false);

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

  const onChipClick = (category: CulturalDnaCategory, tag: CulturalDnaTag, selected: boolean) => {
    if (!selected && tag.mechanism === "signal" && atSignalLimit) {
      setShakeId(tag.qlooTagId);
      setShowLimit(true);
      return;
    }
    void onToggle(category, tag);
  };

  const q = query.trim().toLowerCase();
  const matches = function (tag: CulturalDnaTag) {
    if (!q) return true;
    return likeLabel(locale, tag).toLowerCase().includes(q);
  };

  const instant = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 520, damping: 28 };
  const fade = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeOut" as const };
  const stagger = reduceMotion ? 0 : 0.03;

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
          className="h-10 min-h-10 px-3"
          aria-pressed={granted}
          onClick={() => void setConsent(!granted)}
        >
          {granted ? t(locale, "culture.consent_on") : t(locale, "culture.consent_off")}
        </Button>
      </div>

      <section className="min-w-0 space-y-2 rounded-2xl border border-border bg-bg-elevated/70 p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink break-words">{t(locale, "culture.your_dna")}</h3>
          <motion.p
            key={signalCount}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
            className="shrink-0 text-xs font-semibold tabular-nums text-accent"
          >
            {t(locale, "culture.signal_count", { count: signalCount })}
          </motion.p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {chosen.length === 0 ? (
              <motion.p
                key="empty"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                className="text-xs text-ink-muted break-words"
              >
                {t(locale, "culture.pick_likes")}
              </motion.p>
            ) : (
              chosen.map(function (entry) {
                const label = likeLabel(locale, entry.tag);
                return (
                  <motion.button
                    key={entry.tag.qlooTagId}
                    type="button"
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.86 }}
                    transition={instant}
                    onClick={() => void onToggle(entry.category, entry.tag)}
                    aria-label={t(locale, "culture.remove_like", { label })}
                    className="inline-flex min-h-10 max-w-full items-center gap-1.5 break-words rounded-full border border-accent bg-accent-soft px-3 text-xs font-semibold text-accent"
                  >
                    <span className="min-w-0 break-words">{label}</span>
                    <X className="size-3.5 shrink-0" aria-hidden />
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

      <Input
        value={query}
        onChange={function (event) {
          setQuery(event.target.value);
        }}
        placeholder={t(locale, "culture.search")}
        aria-label={t(locale, "culture.search")}
        className="min-h-10"
      />

      <section className="min-w-0 space-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink break-words">
            {t(locale, "culture.filter_section")}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted break-words">{t(locale, "culture.filter_hint")}</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {CATEGORIES.flatMap(verifiedTags)
            .filter(function (tag) {
              return tag.mechanism === "filter" && matches(tag);
            })
            .map(function (tag, index) {
              const category = CATEGORIES.find(function (cat) {
                return verifiedTags(cat).some(function (item) {
                  return item.qlooTagId === tag.qlooTagId;
                });
              });
              if (!category) return null;
              return (
                <TasteChip
                  key={tag.qlooTagId}
                  tag={tag}
                  label={likeLabel(locale, tag)}
                  selected={isSelected(profile[category], tag)}
                  filter
                  reduceMotion={Boolean(reduceMotion)}
                  delay={index * stagger}
                  shake={shakeId === tag.qlooTagId}
                  onShakeEnd={function () {
                    setShakeId("");
                  }}
                  onClick={function () {
                    onChipClick(category, tag, isSelected(profile[category], tag));
                  }}
                />
              );
            })}
        </div>
      </section>

      {showLimit || atSignalLimit ? (
        <p className="text-xs text-ink-faint break-words">{t(locale, "culture.signal_limit")}</p>
      ) : null}

      {CATEGORIES.map(function (category) {
        const options = verifiedTags(category).filter(function (tag) {
          return tag.mechanism === "signal" && matches(tag);
        });
        if (options.length === 0) return null;
        const expanded = Boolean(open[category] || q);
        return (
          <div key={category} className="min-w-0">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={function () {
                setOpen(function (current) {
                  return { ...current, [category]: !current[category] };
                });
              }}
              className="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {t(locale, CATEGORY_KEYS[category])}
              </span>
              <motion.span
                animate={reduceMotion ? undefined : { rotate: expanded ? 180 : 0 }}
                transition={fade}
                className="text-ink-faint"
              >
                <ChevronDown className="size-4" aria-hidden />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  key={category}
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={fade}
                  className="overflow-hidden"
                >
                  <div className="flex min-w-0 flex-wrap gap-2 pb-1 pt-2">
                    {options.map(function (tag, index) {
                      const selected = isSelected(profile[category], tag);
                      return (
                        <TasteChip
                          key={tag.qlooTagId}
                          tag={tag}
                          label={likeLabel(locale, tag)}
                          selected={selected}
                          dimmed={!selected && atSignalLimit}
                          reduceMotion={Boolean(reduceMotion)}
                          delay={index * stagger}
                          shake={shakeId === tag.qlooTagId}
                          onShakeEnd={function () {
                            setShakeId("");
                          }}
                          onClick={function () {
                            onChipClick(category, tag, selected);
                          }}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </Card>
  );
}

function TasteChip({
  tag,
  label,
  selected,
  filter = false,
  dimmed = false,
  reduceMotion,
  delay,
  shake,
  onShakeEnd,
  onClick,
}: {
  tag: CulturalDnaTag;
  label: string;
  selected: boolean;
  filter?: boolean;
  dimmed?: boolean;
  reduceMotion: boolean;
  delay: number;
  shake: boolean;
  onShakeEnd: () => void;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={
        shake && !reduceMotion
          ? { opacity: dimmed ? 0.45 : 1, x: [0, -5, 5, -3, 3, 0] }
          : { opacity: dimmed ? 0.45 : 1, x: 0, y: 0 }
      }
      transition={
        shake && !reduceMotion
          ? { duration: 0.32 }
          : reduceMotion
            ? { duration: 0 }
            : { delay, type: "spring", stiffness: 520, damping: 28 }
      }
      onAnimationComplete={function () {
        if (shake) onShakeEnd();
      }}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      className={cn(
        "inline-flex min-h-10 max-w-full items-center gap-1.5 break-words rounded-full border px-3 text-xs font-semibold",
        selected
          ? "border-accent bg-accent-soft text-accent shadow-[0_0_16px_var(--color-accent-glow)]"
          : filter
            ? "border-2 border-accent bg-surface-elevated text-ink"
            : "border-border bg-surface text-ink-muted"
      )}
    >
      <span className="min-w-0 break-words">{label}</span>
      <AnimatePresence initial={false}>
        {selected ? (
          <motion.span
            key={`${tag.qlooTagId}-check`}
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? undefined : { scale: 0, opacity: 0 }}
            className="inline-flex"
          >
            <Check className="size-3.5 shrink-0" aria-hidden />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
