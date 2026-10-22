"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { t } from "@/lib/i18n/dictionaries";
import { fetchQlooEntities } from "@/lib/qloo/apiFetch";
import { QLOO_MAX_ENTITIES } from "@/lib/qloo/types";
import type { QlooLovedEntity } from "@/lib/qloo/types";
import { useAppStore } from "@/store/appStore";
import type { CulturalProfile } from "@/types";

type SearchStatus = "idle" | "loading" | "empty" | "unavailable" | "ok";

export function LovedEntitiesField({
  profile,
  granted,
  onChange,
}: {
  profile: CulturalProfile;
  granted: boolean;
  onChange: (next: CulturalProfile) => void;
}) {
  const reduceMotion = useReducedMotion();
  const locale = useAppStore(function (s) {
    return s.locale;
  });
  const chosen = profile.lovedEntities ?? [];
  const atLimit = chosen.length >= QLOO_MAX_ENTITIES;
  const selectedIds = new Set(
    chosen.map(function (entity) {
      return entity.id;
    })
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([] as QlooLovedEntity[]);
  const [status, setStatus] = useState("idle" as SearchStatus);
  const requestId = useRef(0);

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" as const };
  const instant = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 28 };

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (!granted || trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const id = ++requestId.current;
    setStatus("loading");
    const payload = await fetchQlooEntities(trimmed);
    if (id !== requestId.current) return;
    if (payload.source !== "qloo") {
      setResults([]);
      setStatus("unavailable");
      return;
    }
    setResults(payload.entities);
    setStatus(payload.entities.length === 0 ? "empty" : "ok");
  };

  useEffect(() => {
    if (!granted) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const timer = window.setTimeout(function () {
      void (async function () {
        const id = ++requestId.current;
        setStatus("loading");
        const payload = await fetchQlooEntities(trimmed);
        if (id !== requestId.current) return;
        if (payload.source !== "qloo") {
          setResults([]);
          setStatus("unavailable");
          return;
        }
        setResults(payload.entities);
        setStatus(payload.entities.length === 0 ? "empty" : "ok");
      })();
    }, 350);
    return function () {
      window.clearTimeout(timer);
    };
  }, [query, granted]);

  const persistLoved = (lovedEntities: QlooLovedEntity[]) => {
    const next: CulturalProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    if (lovedEntities.length > 0) next.lovedEntities = lovedEntities;
    else delete next.lovedEntities;
    onChange(next);
  };

  const addEntity = (entity: QlooLovedEntity) => {
    if (!granted || atLimit) return;
    if (selectedIds.has(entity.id)) return;
    persistLoved([...chosen, entity].slice(0, QLOO_MAX_ENTITIES));
  };

  const removeEntity = (id: string) => {
    persistLoved(
      chosen.filter(function (entity) {
        return entity.id !== id;
      })
    );
  };

  const visibleResults = results.filter(function (entity) {
    return !selectedIds.has(entity.id);
  });

  return (
    <section className="min-w-0 max-w-full space-y-2 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 p-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink break-words">
          {t(locale, "culture.tell_what_you_love")}
        </h3>
        <p className="mt-1 text-xs text-ink-muted break-words">
          {t(locale, "culture.love_search_hint")}
        </p>
      </div>

      <div className="flex min-w-0 max-w-full flex-wrap gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {chosen.map(function (entity) {
            return (
              <motion.button
                key={entity.id}
                type="button"
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.86 }}
                transition={instant}
                disabled={!granted}
                onClick={function () {
                  removeEntity(entity.id);
                }}
                aria-label={t(locale, "culture.remove_love", { label: entity.name })}
                className="inline-flex min-h-10 max-w-full items-center gap-1.5 break-words rounded-full border border-accent bg-accent-soft px-3 text-xs font-semibold text-accent"
              >
                <span className="min-w-0 break-words">{entity.name}</span>
                <X className="size-3.5 shrink-0" aria-hidden />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {!granted ? (
        <p className="text-xs text-ink-faint break-words">{t(locale, "culture.love_needs_consent")}</p>
      ) : (
        <form
          className="flex min-w-0 max-w-full items-end gap-2"
          onSubmit={function (event) {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={function (event) {
                setQuery(event.target.value);
              }}
              placeholder={t(locale, "culture.love_search_hint")}
              aria-label={t(locale, "culture.tell_what_you_love")}
              disabled={!granted}
              className="min-h-10"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-10 min-h-10 shrink-0 px-3"
            disabled={!granted || query.trim().length < 2}
          >
            {t(locale, "culture.love_search")}
          </Button>
        </form>
      )}

      {granted && atLimit ? (
        <p className="text-xs text-ink-faint break-words">{t(locale, "culture.love_limit")}</p>
      ) : null}

      {granted && status === "empty" ? (
        <p className="text-xs text-ink-muted break-words">{t(locale, "culture.love_empty")}</p>
      ) : null}
      {granted && status === "unavailable" ? (
        <p className="text-xs text-ink-muted break-words">{t(locale, "culture.love_unavailable")}</p>
      ) : null}

      {granted && visibleResults.length > 0 ? (
        <ul className="min-w-0 max-w-full space-y-1 overflow-hidden">
          {visibleResults.map(function (entity) {
            const typeLabel = entity.type.replace(/^urn:entity:/, "");
            return (
              <li key={entity.id} className="min-w-0">
                <motion.button
                  type="button"
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={fade}
                  disabled={atLimit}
                  onClick={function () {
                    addEntity(entity);
                  }}
                  className="flex min-h-10 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 text-left text-sm text-ink"
                >
                  <span className="min-w-0 break-words">{entity.name}</span>
                  {typeLabel ? (
                    <span className="shrink-0 text-xs text-ink-faint break-words">{typeLabel}</span>
                  ) : null}
                </motion.button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
