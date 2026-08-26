"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Compass, Home, Map, Sparkles, Wallet } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionaries";

const tabs = [
  { href: "/app", icon: Home, key: "nav.home" as const },
  { href: "/app/pockets", icon: Wallet, key: "nav.pockets" as const },
  { href: "/app/navi", icon: Sparkles, key: "nav.navi" as const, center: true },
  { href: "/app/activity", icon: Compass, key: "nav.activity" as const },
  { href: "/app/trip", icon: Map, key: "nav.trip" as const },
];

export function NavigationBar({ locale = "en" }: { locale?: Locale }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-bg/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const active =
            tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex items-center justify-center">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-full h-full touch-target text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-ink-faint hover:text-ink-muted",
                  tab.center && "-mt-4"
                )}
                aria-current={active ? "page" : undefined}
              >
                {tab.center ? (
                  <span
                    className={cn(
                      "h-14 w-14 rounded-full flex items-center justify-center border shadow-glow",
                      active
                        ? "bg-accent text-bg border-accent"
                        : "bg-surface-elevated text-accent border-accent/40"
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                ) : (
                  <Icon className="h-5 w-5" aria-hidden />
                )}
                <span className={cn(tab.center && "mt-1")}>{t(locale, tab.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
