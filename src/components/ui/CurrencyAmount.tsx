"use client";

import type { CurrencyCode } from "@/types";
import { formatMoney } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function CurrencyAmount({
  amount,
  currency,
  size = "md",
  showCode,
  className,
  animate = true,
}: {
  amount: number;
  currency: CurrencyCode;
  size?: "sm" | "md" | "lg" | "xl";
  showCode?: boolean;
  className?: string;
  animate?: boolean;
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
    xl: "text-4xl tracking-tight",
  };

  const content = formatMoney(amount, currency, { showCode });

  if (!animate) {
    return (
      <span className={cn("font-display font-semibold tabular-nums", sizes[size], className)}>
        {content}
      </span>
    );
  }

  return (
    <motion.span
      key={content}
      initial={{ opacity: 0.4, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("font-display font-semibold tabular-nums inline-block", sizes[size], className)}
    >
      {content}
    </motion.span>
  );
}
