"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { readUserCookie, parsePublicUser, type PublicUser } from "@/lib/auth/public-user";

const SessionContext = createContext<PublicUser | null>(null);

// The cookie emits no change events, so there's nothing to subscribe to; we
// re-read on each navigation-driven render instead (see usePathname below).
const noopSubscribe = () => () => undefined;

/**
 * Provides the signed-in user's public identity to client components (the nav),
 * read from the non-httpOnly mirror cookie via `useSyncExternalStore` — which is
 * SSR-safe (server snapshot is ""), so hydration matches and there's no
 * setState-in-effect. `usePathname()` forces a re-render on navigation, so the
 * cookie is re-read right after login/logout (both redirect).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  usePathname();
  const raw = useSyncExternalStore(noopSubscribe, readUserCookie, () => "");
  const user = useMemo(() => parsePublicUser(raw), [raw]);
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): PublicUser | null {
  return useContext(SessionContext);
}
