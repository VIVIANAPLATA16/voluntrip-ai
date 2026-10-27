"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Compass,
  Heart,
  LayoutDashboard,
  Map,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { t, type Locale } from "@/lib/i18n/dictionaries";

const links = [
  { href: "/app", icon: LayoutDashboard, key: "nav.dashboard" as const },
  { href: "/app/profile", icon: Heart, key: "nav.profile" as const },
  { href: "/app/pockets", icon: Wallet, key: "nav.pockets" as const },
  { href: "/app/activity", icon: Compass, key: "nav.activity" as const },
  { href: "/app/trip", icon: Map, key: "nav.trip" as const },
  { href: "/app/goals", icon: Target, key: "nav.goals" as const },
  { href: "/app/navi", icon: Sparkles, key: "nav.navi" as const },
];

export function DesktopSidebar({ locale = "en" }: { locale?: Locale }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-bg-elevated/80 min-h-screen sticky top-0 p-5">
      <Logo />
      <p className="mt-2 text-xs text-ink-faint leading-relaxed">
        {t(locale, "app.tagline")}
      </p>
      <nav className="mt-8 flex flex-col gap-1" aria-label="Desktop">
        {links.map((link) => {
          const active =
            link.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 min-h-10 h-11 px-3 rounded-xl text-sm font-medium transition-colors motion-reduce:transition-none",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-muted hover:text-ink hover:bg-surface"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(locale, link.key)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <Link
          href="/app/navi"
          className="flex items-center gap-3 p-3 rounded-card border border-accent/30 bg-accent-soft/40 hover:bg-accent-soft transition-colors"
        >
          <Sparkles className="h-5 w-5 text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">{t(locale, "sidebar.ask_navi")}</p>
            <p className="text-xs text-ink-faint">{t(locale, "sidebar.ai_companion")}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
