"use client";

import type { NaviState } from "@/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";

export function AIOrb({
  state = "idle",
  size = "lg",
  className,
  onClick,
}: {
  state?: NaviState;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}) {
  const locale = useAppStore((s) => s.locale);
  const sizes = { sm: "h-14 w-14", md: "h-24 w-24", lg: "h-36 w-36" };
  const pulse =
    state === "listening"
      ? 1.08
      : state === "thinking"
        ? 1.04
        : state === "success"
          ? 1.06
          : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`NAVI AI agent — ${state}`}
      className={cn("relative touch-target rounded-full", sizes[size], className)}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(125, 250, 230, 0.95), rgba(45, 212, 191, 0.55) 45%, rgba(14, 116, 144, 0.35) 75%, transparent)",
          boxShadow: "0 0 48px rgba(45, 212, 191, 0.35)",
        }}
        animate={{ scale: pulse }}
        transition={{ duration: 1.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />
      {/* particles */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-white/70"
          style={{
            left: `${20 + (i * 13) % 60}%`,
            top: `${15 + (i * 17) % 70}%`,
          }}
          animate={{
            opacity: state === "idle" ? [0.2, 0.8, 0.2] : [0.4, 1, 0.4],
            y: [0, -6, 0],
          }}
          transition={{
            duration: 2 + i * 0.2,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
      <span className="relative z-10 font-display text-xs font-bold tracking-[0.2em] text-bg/90">
        NAVI
      </span>
      {state === "listening" && (
        <span className="sr-only">{t(locale, "navi.listening")}</span>
      )}
    </button>
  );
}
