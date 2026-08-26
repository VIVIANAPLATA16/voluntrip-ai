"use client";

import type { Transaction } from "@/types";
import { formatMoney } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Mic, PenLine, Receipt, Type } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { categoryLabel } from "@/lib/i18n/labels";

const sourceIcon = {
  text: Type,
  voice: Mic,
  receipt: Receipt,
  manual: PenLine,
};

export function TransactionItem({
  transaction,
  className,
}: {
  transaction: Transaction;
  className?: string;
}) {
  const locale = useAppStore((s) => s.locale);
  const Icon = sourceIcon[transaction.source] || PenLine;
  const date = new Date(transaction.createdAt);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <article
      className={cn(
        "flex items-center gap-3 py-3 border-b border-border-subtle last:border-0",
        className
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-ink-muted shrink-0">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink truncate">{transaction.concept}</p>
        <p className="text-xs text-ink-faint truncate">
          {categoryLabel(locale, transaction.category)} · {day} · {time} · {transaction.source}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display font-semibold text-sm text-ink">
          −{formatMoney(transaction.amountOriginal, transaction.currencyOriginal)}
        </p>
        <p className="text-xs text-ink-faint">
          ≈ {formatMoney(transaction.amountBase, transaction.currencyBase)}
        </p>
      </div>
    </article>
  );
}
