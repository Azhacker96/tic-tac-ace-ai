import { Link, useRouterState } from "@tanstack/react-router";
import { Gamepad2, Gift, ShoppingBag, UserRound, UsersRound } from "lucide-react";

import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/home", label: "Play", icon: Gamepad2 },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/coins", label: "Rewards", icon: Gift },
  { to: "/friends", label: "Friends", icon: UsersRound },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export const NAV_PATHS: string[] = TABS.map((t) => t.to);

/** Fixed thumb-zone tab bar shown on the five main tabs only. */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { identity } = useApp();
  if (!identity || !NAV_PATHS.includes(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                replace
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/15",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom spacer so content never hides behind the tab bar. */
export function useHasBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return NAV_PATHS.includes(pathname);
}
