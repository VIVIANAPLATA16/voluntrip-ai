"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import {
  DESTINATION_COUNTRIES,
  DESTINATION_TABS,
  getCountriesByTab,
  searchAllDestinationCountries,
  type DestinationCountry,
  type DestinationTab,
} from "@/lib/constants";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { destinationTabLabel } from "@/lib/i18n/labels";

export type SelectedLocation = {
  country: string;
  countryCode: string;
  flag: string;
  localCurrency: CurrencyCode;
  /** null = whole country / general */
  city: string | null;
};

interface DestinationPickerProps {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
}

export function DestinationPicker({ value, onChange }: DestinationPickerProps) {
  const locale = useAppStore((s) => s.locale);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<DestinationTab>("popular");
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(
    value?.countryCode ?? null
  );

  const isSearching = query.trim().length > 0;

  const { countries, autoExpandCode, matchedCity } = useMemo(() => {
    if (isSearching) {
      return searchAllDestinationCountries(query, DESTINATION_COUNTRIES);
    }
    return {
      countries: getCountriesByTab(activeTab, DESTINATION_COUNTRIES),
      autoExpandCode: null,
      matchedCity: null,
    };
  }, [query, activeTab, isSearching]);

  useEffect(() => {
    if (isSearching && autoExpandCode) {
      setExpandedCountryId(autoExpandCode);
    }
  }, [isSearching, autoExpandCode, matchedCity]);

  const toggleCountry = (code: string) => {
    setExpandedCountryId((prev) => (prev === code ? null : code));
  };

  const selectCountryGeneral = (c: DestinationCountry) => {
    onChange({
      country: c.country,
      countryCode: c.code,
      flag: c.flag,
      localCurrency: c.localCurrency,
      city: null,
    });
    setExpandedCountryId(c.code);
  };

  const selectCity = (c: DestinationCountry, city: string) => {
    onChange({
      country: c.country,
      countryCode: c.code,
      flag: c.flag,
      localCurrency: c.localCurrency,
      city,
    });
    setExpandedCountryId(c.code);
  };

  const isCountrySelected = (c: DestinationCountry) =>
    value?.countryCode === c.code;

  const isGeneralSelected = (c: DestinationCountry) =>
    value?.countryCode === c.code && value.city === null;

  const isCitySelected = (c: DestinationCountry, city: string) =>
    value?.countryCode === c.code && value.city === city;

  const q = query.toLowerCase().trim();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, "destination.search_placeholder")}
          className="w-full h-12 pl-11 pr-4 rounded-2xl bg-bg-elevated border border-border text-ink placeholder:text-ink-faint focus:border-accent/60 focus:ring-2 focus:ring-accent/20 outline-none"
          aria-label={t(locale, "destination.search_aria")}
        />
      </div>

      {!isSearching && (
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
          role="tablist"
          aria-label={t(locale, "destination.filter_aria")}
        >
          {DESTINATION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 h-10 px-3.5 rounded-full text-xs font-medium touch-target transition-colors border",
                activeTab === tab.id
                  ? "bg-accent-soft text-accent border-accent/40"
                  : "bg-surface text-ink-muted border-border hover:text-ink hover:border-border"
              )}
            >
              {destinationTabLabel(locale, tab.id)}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-faint">
        {isSearching
          ? t(locale, "destination.search_matches", {
              count: countries.length,
              countLabel:
                countries.length === 1
                  ? t(locale, "destination.match_one")
                  : t(locale, "destination.match_many"),
            })
          : t(locale, "destination.countries_in_tab", {
              count: countries.length,
              tab: destinationTabLabel(locale, activeTab),
            })}
      </p>

      {value && (
        <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft/40 px-3 py-2.5 text-sm">
          <span aria-hidden>{value.flag}</span>
          <span className="font-medium text-ink truncate">
            {value.city ? `${value.city}, ${value.country}` : value.country}
          </span>
          <Check className="ml-auto h-4 w-4 text-accent shrink-0" aria-hidden />
        </div>
      )}

      <ul
        className="space-y-2 max-h-[50dvh] overflow-y-auto scrollbar-hide pb-1"
        role="list"
      >
        {countries.map((c) => {
          const expanded = expandedCountryId === c.code;
          const selected = isCountrySelected(c);

          return (
            <li
              key={c.code}
              className="rounded-2xl border border-border bg-surface overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleCountry(c.code)}
                aria-expanded={expanded}
                className={cn(
                  "w-full flex items-center gap-3 p-3 touch-target text-left transition-colors",
                  selected ? "bg-accent-soft/50" : "hover:bg-surface-elevated"
                )}
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  {c.flag}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">
                    {c.country} {c.flag}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {c.cities.length}{" "}
                    {c.cities.length === 1
                      ? t(locale, "destination.city_one")
                      : t(locale, "destination.city_many")}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-ink-faint shrink-0 transition-transform duration-200",
                    expanded && "rotate-180 text-accent"
                  )}
                  aria-hidden
                />
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="cities"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border-subtle px-2 pb-2 pt-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => selectCountryGeneral(c)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left touch-target transition-colors",
                          isGeneralSelected(c)
                            ? "bg-accent-soft text-accent"
                            : "text-ink-muted hover:bg-bg-elevated hover:text-ink"
                        )}
                      >
                        <MapPin
                          className="h-4 w-4 shrink-0 opacity-70"
                          aria-hidden
                        />
                        <span className="text-sm font-medium flex-1">
                          {t(locale, "destination.anywhere_in", { country: c.country })}
                        </span>
                        {isGeneralSelected(c) && (
                          <Check className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </button>

                      {c.cities.map((city) => {
                        const highlighted = Boolean(
                          q && city.toLowerCase().includes(q)
                        );
                        const citySelected = isCitySelected(c, city);
                        return (
                          <button
                            key={city}
                            type="button"
                            onClick={() => selectCity(c, city)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left touch-target transition-colors",
                              citySelected
                                ? "bg-accent-soft text-accent"
                                : highlighted
                                  ? "bg-surface-elevated text-ink"
                                  : "text-ink-muted hover:bg-bg-elevated hover:text-ink"
                            )}
                          >
                            <span className="w-4 shrink-0" aria-hidden />
                            <span className="text-sm font-medium flex-1">
                              {city}
                            </span>
                            {citySelected && (
                              <Check className="h-4 w-4 shrink-0" aria-hidden />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}

        {countries.length === 0 && (
          <li className="py-10 text-center text-sm text-ink-faint">
            {isSearching
              ? t(locale, "destination.no_match", { query })
              : t(locale, "destination.no_countries_region")}
          </li>
        )}
      </ul>
    </div>
  );
}
