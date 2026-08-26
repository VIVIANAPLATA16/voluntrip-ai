"use client";

import { TransactionItem } from "@/components/ui/TransactionItem";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { categoryLabel } from "@/lib/i18n/labels";
import { createTransaction } from "@/lib/finance/transactions";
import { CURRENCIES } from "@/lib/constants";
import type { CurrencyCode } from "@/types";
import { useState } from "react";

const CATEGORIES = ["food", "transport", "fun", "general"] as const;

export default function ActivityPage() {
  const trip = useAppStore((s) => s.trip);
  const transactions = useAppStore((s) => s.transactions);
  const locale = useAppStore((s) => s.locale);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const removeTransaction = useAppStore((s) => s.removeTransaction);
  const [open, setOpen] = useState(false);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("THB");
  const [category, setCategory] = useState("food");

  const save = async () => {
    if (!trip || !concept) return;
    const tx = createTransaction({
      tripId: trip.id,
      amountOriginal: parseFloat(amount) || 0,
      currencyOriginal: currency,
      currencyBase: trip.baseCurrency,
      concept,
      category,
      source: "manual",
    });
    await addTransaction(tx);
    setOpen(false);
    setConcept("");
    setAmount("");
  };

  if (!trip) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t(locale, "activity.title")}</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t(locale, "activity.add")}
        </Button>
      </div>
      <div className="rounded-card border border-border bg-surface/70 px-4">
        {transactions.map((tx) => (
          <div key={tx.id} className="group">
            <TransactionItem transaction={tx} />
            <button
              type="button"
              className="text-xs text-danger pb-2 touch-target"
              onClick={() => void removeTransaction(tx.id)}
            >
              {t(locale, "common.delete")}
            </button>
          </div>
        ))}
        {transactions.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-faint">
            {t(locale, "activity.no_movements_yet")}
          </p>
        )}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, "activity.register_expense")}
      >
        <div className="space-y-4">
          <Input
            label={t(locale, "common.concept")}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
          <Input
            label={t(locale, "common.amount")}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-muted">{t(locale, "common.currency")}</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="h-12 px-4 rounded-2xl bg-bg-elevated border border-border"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-muted">{t(locale, "common.category")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-12 px-4 rounded-2xl bg-bg-elevated border border-border"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(locale, c)}
                </option>
              ))}
            </select>
          </label>
          <Button className="w-full" onClick={() => void save()}>
            {t(locale, "common.save")}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
