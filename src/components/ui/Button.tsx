"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-bg font-semibold shadow-glow hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-surface-elevated text-ink border border-border hover:bg-surface active:scale-[0.98]",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-surface/60",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
  outline:
    "bg-transparent border border-border text-ink hover:border-accent/50 hover:text-accent",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3 text-sm rounded-xl",
  md: "h-12 px-5 text-sm rounded-2xl",
  lg: "h-14 px-6 text-base rounded-2xl",
  icon: "h-11 w-11 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 touch-target transition-all duration-200 focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
