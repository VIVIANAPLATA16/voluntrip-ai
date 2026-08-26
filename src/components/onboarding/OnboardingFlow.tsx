"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { CURRENCIES } from "@/lib/constants";
import { daysBetween } from "@/lib/finance/budget";
import type { HostBenefit, CurrencyCode, LocaleCode } from "@/types";
import { SUPPORTED_LOCALES, t } from "@/lib/i18n/dictionaries";
import { benefitLabel } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import {
  DestinationPicker,
  type SelectedLocation,
} from "@/components/onboarding/DestinationPicker";

const BENEFITS: HostBenefit[] = [
  "accommodation",
  "breakfast",
  "lunch",
  "dinner",
  "laundry",
  "transport",
  "tours",
];

const PROTECT_OPTIONS = [
  { key: "protectEmergency" as const, labelKey: "onboarding.emergency_fund" as const },
  { key: "protectFlight" as const, labelKey: "onboarding.return_flight" as const },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const onboarding = useAppStore((s) => s.onboarding);
  const updateOnboarding = useAppStore((s) => s.updateOnboarding);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const [protectToggles, setProtectToggles] = useState({
    emergency: false,
    flight: false,
    custom: false,
  });

  const selectedLocation: SelectedLocation | null = onboarding.country
    ? {
        country: onboarding.country,
        countryCode: onboarding.countryCode,
        flag: onboarding.flag,
        localCurrency: onboarding.localCurrency,
        city: onboarding.city || null,
      }
    : null;

  const handleDestinationChange = (location: SelectedLocation) => {
    updateOnboarding({
      country: location.country,
      countryCode: location.countryCode,
      flag: location.flag,
      localCurrency: location.localCurrency,
      city: location.city ?? "",
    });
  };

  const tripDays = daysBetween(onboarding.startDate, onboarding.endDate);

  const next = () => setStep((s) => Math.min(s + 1, 6));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    await completeOnboarding();
    router.push("/app");
  };

  const tryDemo = async () => {
    await loadDemo();
    router.push("/app");
  };

  return (
    <div className="min-h-screen flex flex-col px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <Logo size="sm" />
        {step > 0 && (
          <span className="text-xs text-ink-faint tabular-nums">{step}/6</span>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28 }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && (
              <div className="flex-1 flex flex-col justify-center text-center space-y-8">
                <div className="mx-auto">
                  <div className="relative h-28 w-28 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl animate-pulse-soft" />
                    <div className="relative h-full w-full rounded-full border border-accent/40 bg-surface flex items-center justify-center shadow-glow">
                      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden>
                        <circle cx="32" cy="32" r="22" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
                        <path d="M32 12 L36 32 L32 52 L28 32 Z" fill="#2dd4bf" />
                        <path d="M12 32 L32 28 L52 32 L32 36 Z" fill="#38bdf8" opacity="0.5" />
                        <circle cx="48" cy="16" r="3" fill="#f1f5f9" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <h1 className="font-display text-4xl font-semibold tracking-tight">
                    {t(locale, "onboarding.welcome_title")}
                  </h1>
                  <p className="mt-3 text-lg text-ink-muted text-balance">
                    {t(locale, "onboarding.welcome_sub")}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
                    {t(locale, "onboarding.language")}
                  </p>
                  <div className="flex justify-center gap-2">
                    {SUPPORTED_LOCALES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLocale(l as LocaleCode)}
                        className={cn(
                          "h-10 min-w-[3rem] px-3 rounded-full text-sm font-semibold touch-target transition-colors border",
                          locale === l
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-border bg-surface text-ink-muted hover:text-ink"
                        )}
                        aria-pressed={locale === l}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <Button className="w-full" size="lg" onClick={next}>
                    {t(locale, "onboarding.start")}
                  </Button>
                  <Button className="w-full" variant="ghost" onClick={tryDemo}>
                    {t(locale, "onboarding.load_demo")}
                  </Button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h1 className="font-display text-3xl font-semibold">
                  {t(locale, "onboarding.where")}
                </h1>
                <DestinationPicker
                  value={selectedLocation}
                  onChange={handleDestinationChange}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h1 className="font-display text-3xl font-semibold">
                  {t(locale, "onboarding.how_long")}
                </h1>
                <Input
                  type="date"
                  label={t(locale, "onboarding.start_date")}
                  value={onboarding.startDate}
                  onChange={(e) => updateOnboarding({ startDate: e.target.value })}
                />
                <Input
                  type="date"
                  label={t(locale, "onboarding.end_date")}
                  value={onboarding.endDate}
                  onChange={(e) => updateOnboarding({ endDate: e.target.value })}
                />
                <div className="rounded-card border border-border bg-surface p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-faint">
                    {t(locale, "onboarding.duration")}
                  </p>
                  <p className="font-display text-4xl font-semibold mt-2">
                    {tripDays} {t(locale, "onboarding.days")}
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h1 className="font-display text-3xl font-semibold">
                  {t(locale, "onboarding.currency")}
                </h1>
                <div className="grid grid-cols-3 gap-2 max-h-[55dvh] overflow-y-auto scrollbar-hide">
                  {CURRENCIES.map((c) => {
                    const selected = onboarding.baseCurrency === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() =>
                          updateOnboarding({ baseCurrency: c.code as CurrencyCode })
                        }
                        className={cn(
                          "h-14 rounded-2xl border text-sm font-semibold touch-target transition-colors",
                          selected
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-border bg-surface text-ink-muted"
                        )}
                      >
                        {c.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h1 className="font-display text-3xl font-semibold">
                  {t(locale, "onboarding.volunteer")}
                </h1>
                <p className="text-ink-muted">{t(locale, "onboarding.host_covers")}</p>
                <Input
                  label={t(locale, "onboarding.host_name")}
                  value={onboarding.hostName}
                  onChange={(e) => updateOnboarding({ hostName: e.target.value })}
                  placeholder={t(locale, "onboarding.host_placeholder")}
                />
                <div className="flex flex-wrap gap-2">
                  {BENEFITS.map((id) => {
                    const selected = onboarding.includedBenefits.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          const nextBenefits = selected
                            ? onboarding.includedBenefits.filter((x) => x !== id)
                            : [...onboarding.includedBenefits, id];
                          updateOnboarding({ includedBenefits: nextBenefits });
                        }}
                        className={cn(
                          "h-11 px-4 rounded-2xl border text-sm touch-target transition-colors",
                          selected
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-border bg-surface text-ink-muted"
                        )}
                      >
                        {benefitLabel(locale, id)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <h1 className="font-display text-3xl font-semibold">
                  {t(locale, "onboarding.budget")}
                </h1>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    label={t(locale, "common.amount")}
                    value={String(onboarding.initialBudget)}
                    onChange={(e) =>
                      updateOnboarding({ initialBudget: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <label className="flex flex-col gap-1.5 w-28">
                    <span className="text-sm text-ink-muted font-medium">
                      {t(locale, "common.currency")}
                    </span>
                    <div className="h-12 px-3 rounded-2xl bg-bg-elevated border border-border flex items-center font-semibold">
                      {onboarding.baseCurrency}
                    </div>
                  </label>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5">
                <h1 className="font-display text-3xl font-semibold">
                  {t(locale, "onboarding.protect")}
                </h1>
                <div className="space-y-3">
                  {PROTECT_OPTIONS.map((opt) => {
                    const on =
                      opt.key === "protectEmergency"
                        ? protectToggles.emergency
                        : protectToggles.flight;
                    return (
                      <div
                        key={opt.key}
                        className="rounded-2xl border border-border bg-surface p-4 space-y-3"
                      >
                        <button
                          type="button"
                          className="flex items-center justify-between w-full touch-target"
                          onClick={() =>
                            setProtectToggles((p) => ({
                              ...p,
                              [opt.key === "protectEmergency" ? "emergency" : "flight"]: !on,
                            }))
                          }
                        >
                          <span className="font-medium">{t(locale, opt.labelKey)}</span>
                          <span
                            className={cn(
                              "h-6 w-11 rounded-full border relative transition-colors",
                              on ? "bg-accent border-accent" : "bg-bg border-border"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                                on ? "left-5" : "left-0.5"
                              )}
                            />
                          </span>
                        </button>
                        {on && (
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={String(onboarding[opt.key] || "")}
                            onChange={(e) =>
                              updateOnboarding({
                                [opt.key]: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder={t(locale, "common.amount")}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full touch-target"
                      onClick={() =>
                        setProtectToggles((p) => ({ ...p, custom: !p.custom }))
                      }
                    >
                      <span className="font-medium">{t(locale, "onboarding.custom_pocket")}</span>
                      <span
                        className={cn(
                          "h-6 w-11 rounded-full border relative transition-colors",
                          protectToggles.custom
                            ? "bg-accent border-accent"
                            : "bg-bg border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                            protectToggles.custom ? "left-5" : "left-0.5"
                          )}
                        />
                      </span>
                    </button>
                    {protectToggles.custom && (
                      <>
                        <Input
                          value={onboarding.protectCustomName}
                          onChange={(e) =>
                            updateOnboarding({ protectCustomName: e.target.value })
                          }
                          placeholder={t(locale, "onboarding.name_placeholder")}
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={String(onboarding.protectCustom || "")}
                          onChange={(e) =>
                            updateOnboarding({
                              protectCustom: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder={t(locale, "common.amount")}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {step > 0 && (
        <div className="flex gap-3 mt-6 pt-4 border-t border-border-subtle">
          <Button variant="secondary" className="flex-1" onClick={back}>
            {t(locale, "onboarding.back")}
          </Button>
          {step < 6 ? (
            <Button
              className="flex-1"
              onClick={next}
              disabled={step === 1 && !onboarding.country}
            >
              {t(locale, "onboarding.continue")}
            </Button>
          ) : (
            <Button className="flex-1" onClick={finish}>
              {t(locale, "onboarding.finish")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
