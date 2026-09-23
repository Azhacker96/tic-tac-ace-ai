import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

interface ScreenProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  /** Where the back arrow goes when there is no history to pop. */
  backTo?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Screen({
  title,
  subtitle,
  back = true,
  backTo = "/home",
  action,
  children,
  className,
}: ScreenProps) {
  const router = useRouter();
  const { online } = useApp();

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: backTo });
  };

  return (
    <div className="screen-shell safe-top safe-bottom flex flex-col px-4">
      {(title || back) && (
        <header className="flex items-center gap-3 pb-4">
          {back ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? (
              <h1 className="truncate font-display text-lg tracking-wide">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      )}

      {!online ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <WifiOff className="size-4 shrink-0" />
          Offline — computer and same-device games still work.
        </div>
      ) : null}

      <main className={cn("flex-1 animate-rise pb-6", className)}>{children}</main>
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <div className="size-10 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon ? <div className="text-3xl">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function RequiresGoogle({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon="🔒"
      title={`${feature} needs a Google account`}
      description="Guest profiles stay on this device. Link Google to unlock online play and friends — your nickname, Player ID and stats carry over."
      action={
        <Link
          to="/settings"
          className="mt-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95"
        >
          Link Google account
        </Link>
      }
    />
  );
}
