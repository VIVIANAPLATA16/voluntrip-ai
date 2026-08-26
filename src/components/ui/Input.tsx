"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <label className="flex flex-col gap-1.5 w-full">
        {label && (
          <span className="text-sm text-ink-muted font-medium">{label}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-12 px-4 rounded-2xl bg-bg-elevated border border-border text-ink placeholder:text-ink-faint",
            "focus:border-accent/60 focus:ring-2 focus:ring-accent/20 outline-none transition-colors",
            className
          )}
          {...props}
        />
        {hint && <span className="text-xs text-ink-faint">{hint}</span>}
      </label>
    );
  }
);
Input.displayName = "Input";
