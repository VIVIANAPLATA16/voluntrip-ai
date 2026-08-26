"use client";

import type { Pocket } from "@/types";
import { pocketUsagePercent } from "@/lib/finance/pockets";
import { formatMoney } from "@/lib/constants";
import type { CurrencyCode } from "@/types";
import { Badge } from "./Badge";
import { Progress } from "./Progress";
import { Card } from "./Card";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import { pocketDisplayName } from "@/lib/i18n/labels";
import {
  Bus,
  CreditCard,
  Lock,
  PiggyBank,
  Plane,
  Shield,
  Sparkles,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  shield: Shield,
  utensils: Utensils,
  bus: Bus,
  sparkles: Sparkles,
  plane: Plane,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  wallet: Wallet,
};

export function PocketCard({
  pocket,
  currency,
}: {
  pocket: Pocket;
  currency: CurrencyCode;
}) {
  const locale = useAppStore((s) => s.locale);
  const Icon = iconMap[pocket.icon] || Wallet;
  const usage = pocketUsagePercent(pocket);
  const displayName = pocketDisplayName(locale, pocket);

  return (
    <Card className="flex flex-col gap-3" elevated>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-ink truncate">{displayName}</p>
            <p className="text-sm text-ink-muted">
              {formatMoney(pocket.balance, currency, { showCode: true })}
            </p>
          </div>
        </div>
        {pocket.protected ? (
          <Badge variant="accent">
            <Lock className="h-3 w-3" aria-hidden />
            {t(locale, "pockets.locked")}
          </Badge>
        ) : (
          <Badge>{t(locale, "pockets.open")}</Badge>
        )}
      </div>
      {pocket.allocated > 0 && (
        <Progress
          value={usage}
          label={t(locale, "pocket.usage", { name: displayName })}
        />
      )}
    </Card>
  );
}
