import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  href = "/",
  className,
}: {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}) {
  const sizes = {
    sm: { mark: "h-7 w-7", text: "text-sm" },
    md: { mark: "h-9 w-9", text: "text-base" },
    lg: { mark: "h-12 w-12", text: "text-xl" },
  };
  const s = sizes[size];

  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative rounded-2xl overflow-hidden flex items-center justify-center shrink-0",
          s.mark
        )}
        aria-hidden
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              "conic-gradient(from 210deg, #2dd4bf, #38bdf8, #0ea5e9, #2dd4bf)",
          }}
        />
        <span className="absolute inset-[2px] rounded-[0.9rem] bg-bg flex items-center justify-center">
          {/* Compass + AI spark */}
          <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none">
            <circle cx="16" cy="16" r="11" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.7" />
            <path d="M16 7 L18.2 16 L16 25 L13.8 16 Z" fill="#2dd4bf" opacity="0.9" />
            <path d="M7 16 L16 13.8 L25 16 L16 18.2 Z" fill="#38bdf8" opacity="0.55" />
            <circle cx="24" cy="8" r="1.6" fill="#f1f5f9" />
            <circle cx="26.5" cy="11" r="0.9" fill="#2dd4bf" />
          </svg>
        </span>
      </span>
      <span className={cn("font-display font-semibold tracking-tight text-ink", s.text)}>
        Voluntrip <span className="text-accent">AI</span>
      </span>
    </Link>
  );
}
