"use client";

import { useMemo, useState } from "react";
import type { CurrencyCode } from "@/types";
import { CURRENCIES } from "@/lib/constants";
import { convertCurrency } from "@/lib/finance/currency";
import { formatMoney } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";

export function CurrencyConverter({
  defaultFrom = "THB",
  defaultTo = "USD",
  extra = ["COP", "EUR"],
}: {
  defaultFrom?: CurrencyCode;
  defaultTo?: CurrencyCode;
  extra?: CurrencyCode[];
}) {
  const locale = useAppStore((s) => s.locale);
  const [amount, setAmount] = useState("200");
  const [from, setFrom] = useState<CurrencyCode>(defaultFrom);
  const value = parseFloat(amount) || 0;

  const targets = useMemo(() => {
    const list = Array.from(new Set([defaultTo, ...extra, from])).filter(
      (c) => c !== from
    ) as CurrencyCode[];
    return list.slice(0, 4);
  }, [defaultTo, extra, from]);

  return (
    <Card elevated className="space-y-4">
      <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
        {t(locale, "converter.title")}
      </p>
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={t(locale, "common.amount")}
          className="flex-1"
        />
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value as CurrencyCode)}
          className="h-12 px-3 rounded-2xl bg-bg-elevated border border-border text-ink"
          aria-label={t(locale, "common.currency")}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      <ul className="space-y-2">
        {targets.map((code) => {
          const converted = convertCurrency(value, from, code);
          return (
            <li
              key={code}
              className="flex items-center justify-between text-sm py-2 border-b border-border-subtle last:border-0"
            >
              <span className="text-ink-muted">≈ {code}</span>
              <span className="font-display font-semibold">
                {formatMoney(converted, code, { showCode: true })}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
