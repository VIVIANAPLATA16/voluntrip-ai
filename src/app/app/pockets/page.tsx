"use client";

import { PocketCard } from "@/components/ui/PocketCard";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { createId } from "@/lib/id";
import { useState } from "react";
import type { Pocket } from "@/types";

export default function PocketsPage() {
  const trip = useAppStore((s) => s.trip);
  const pockets = useAppStore((s) => s.pockets);
  const locale = useAppStore((s) => s.locale);
  const upsertPocket = useAppStore((s) => s.upsertPocket);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [locked, setLocked] = useState(false);

  const create = async () => {
    if (!trip || !name) return;
    const amt = parseFloat(amount) || 0;
    const pocket: Pocket = {
      id: createId(),
      tripId: trip.id,
      name,
      category: "custom",
      balance: amt,
      allocated: amt,
      protected: locked,
      icon: "wallet",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertPocket(pocket);
    setOpen(false);
    setName("");
    setAmount("");
    setLocked(false);
  };

  const toggleProtect = async (pocket: Pocket) => {
    await upsertPocket({
      ...pocket,
      protected: !pocket.protected,
      updatedAt: new Date().toISOString(),
    });
  };

  if (!trip) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t(locale, "pockets.title")}</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t(locale, "pockets.new_pocket")}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">{t(locale, "pockets.protected_hint")}</p>
      <div className="space-y-3">
        {pockets.map((p) => (
          <div key={p.id} className="space-y-2">
            <PocketCard pocket={p} currency={trip.baseCurrency} />
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => void toggleProtect(p)}
            >
              {p.protected ? t(locale, "pockets.unlock") : t(locale, "pockets.protect_lock")}
            </Button>
          </div>
        ))}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, "pockets.create_title")}
      >
        <div className="space-y-4">
          <Input
            label={t(locale, "common.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t(locale, "common.amount")}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="flex items-center gap-3 text-sm touch-target">
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setLocked(e.target.checked)}
              className="h-5 w-5 accent-teal-400"
            />
            {t(locale, "pockets.protect_checkbox")}
          </label>
          <Button className="w-full" onClick={() => void create()}>
            {t(locale, "common.save")}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
