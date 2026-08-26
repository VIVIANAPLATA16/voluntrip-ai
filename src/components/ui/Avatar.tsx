import { cn } from "@/lib/utils";

export function Avatar({
  name,
  hue = 168,
  size = "md",
  className,
}: {
  name: string;
  hue?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };
  const initial = name.trim().charAt(0).toUpperCase() || "V";
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-full flex items-center justify-center font-display font-semibold text-bg",
        sizes[size],
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${hue + 30} 60% 35%))`,
      }}
    >
      {initial}
    </div>
  );
}
