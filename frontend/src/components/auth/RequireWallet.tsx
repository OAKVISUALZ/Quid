"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWallet } from "@/context/WalletProvider";
import { ONBOARDING_ROUTES } from "@/lib/onboarding";

/**
 * Issue #332: how long we give the best-effort SEP-10 JWT exchange to settle
 * before treating a connected-but-unauthenticated wallet as needing to
 * re-auth. `connect()` kicks off `authenticate()` in the background, and a
 * returning visit re-hydrates the token from the stored session a tick after
 * mount, so a short grace window avoids bouncing a user who is mid-auth.
 */
const AUTH_SETTLE_MS = 2000;

/**
 * Issue #332: gates the creator/hunter dashboards on wallet connection *and*
 * a valid SEP-10 JWT session, redirecting to `/connect-wallet` with a
 * `returnTo` query param so the user lands back where they started once
 * they're authenticated.
 */
export default function RequireWallet({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connected, isAuthenticated, authError } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  const stillAuthenticating = connected && !isAuthenticated && !authError;

  // Definitely blocked: no wallet, or a wallet whose JWT exchange failed or
  // never settled. While `stillAuthenticating` is true we render children
  // optimistically (matches the pre-#332 behaviour of only checking
  // `connected`) and only flip to blocked if it doesn't resolve in time.
  const needsAuth = !connected || (!isAuthenticated && (Boolean(authError) || authTimedOut));

  useEffect(() => {
    // No reset-to-false branch here on purpose: once `connected` goes false
    // the `needsAuth` check below navigates away (unmounting this component
    // on the next route), so a stale `true` from a prior settle window never
    // gets a chance to leak into a later one.
    if (!stillAuthenticating) return;

    const timer = window.setTimeout(() => setAuthTimedOut(true), AUTH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [stillAuthenticating]);

  useEffect(() => {
    if (!needsAuth) return;

    const query = searchParams?.toString();
    const returnTo = query ? `${pathname}?${query}` : pathname || "/";
    router.replace(
      `${ONBOARDING_ROUTES.signUp}?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [needsAuth, pathname, searchParams, router]);

  if (needsAuth) {
    return (
      <div className="flex h-screen items-center justify-center brutal-grid-bg bg-background text-foreground">
        <div className="brutal-border brutal-shadow bg-card p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin border-[3px] border-foreground border-t-brutal-pink" />
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Checking wallet connection…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
