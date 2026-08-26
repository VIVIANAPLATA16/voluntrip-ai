"use client";

import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/constants";
import { createId } from "@/lib/id";
import type { Goal } from "@/types";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Lock } from "lucide-react";

export default function GoalsPage() {
  const trip = useAppStore((s) => s.trip);
  const goals = useAppStore((s) => s.goals);
  const locale = useAppStore((s) => s.locale);
  const upsertGoal = useAppStore((s) => s.upsertGoal);
  const upsertPocket = useAppStore((s) => s.upsertPocket);
  const pockets = useAppStore((s) => s.pockets);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");

  const create = async () => {
    if (!trip || !name) return;
    const goal: Goal = {
      id: createId(),
      tripId: trip.id,
      name,
      targetAmount: parseFloat(target) || 0,
      currentAmount: parseFloat(current) || 0,
      currency: trip.baseCurrency,
      protected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertGoal(goal);
    setOpen(false);
    setName("");
    setTarget("");
    setCurrent("");
  };

  const protectGoal = async (goal: Goal) => {
    const updated = {
      ...goal,
      protected: true,
      updatedAt: new Date().toISOString(),
    };
    await upsertGoal(updated);
    const existing = pockets.find((p) => p.name === goal.name);
    if (existing) {
      await upsertPocket({
        ...existing,
        protected: true,
        balance: goal.currentAmount,
        allocated: Math.max(existing.allocated, goal.targetAmount),
        updatedAt: new Date().toISOString(),
      });
    } else if (trip) {
      await upsertPocket({
        id: createId(),
        tripId: trip.id,
        name: goal.name,
        category: "savings",
        balance: goal.currentAmount,
        allocated: goal.targetAmount,
        protected: true,
        icon: "piggy-bank",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  if (!trip) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t(locale, "goals.title")}</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t(locale, "goals.new_goal")}
        </Button>
      </div>

      <div className="space-y-3">
        {goals.map((g) => {
          const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
          return (
            <Card key={g.id} elevated className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-sm text-ink-muted mt-1">
                    {formatMoney(g.currentAmount, g.currency)} /{" "}
                    {formatMoney(g.targetAmount, g.currency)}
                  </p>
                </div>
                {g.protected && (
                  <Badge variant="accent">
                    <Lock className="h-3 w-3" />
                    {t(locale, "goals.locked_badge")}
                  </Badge>
                )}
              </div>
              <Progress value={pct} label={g.name} />
              {!g.protected && (
                <Button variant="secondary" size="sm" onClick={() => void protectGoal(g)}>
                  {t(locale, "goals.protect")}
                </Button>
              )}
            </Card>
          );
        })}
        {goals.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-10">
            {t(locale, "goals.empty_hint")}
          </p>
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t(locale, "goals.new_title")}>
        <div className="space-y-4">
          <Input
            label={t(locale, "common.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, "goals.name_placeholder")}
          />
          <Input
            label={t(locale, "goals.target")}
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Input
            label={t(locale, "goals.current")}
            type="number"
            inputMode="decimal"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Button className="w-full" onClick={() => void create()}>
            {t(locale, "common.save")}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
