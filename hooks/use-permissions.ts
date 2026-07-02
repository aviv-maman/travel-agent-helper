"use client";

/**
 * Client-side permission check, used only to decide whether to *show* privileged
 * UI (never as a security boundary — the Server Action re-checks on the server).
 * Keeping it client-side means gated UI can live on a statically-rendered page
 * without forcing it into dynamic rendering.
 *
 * TODO(auth): back this with the real client session (a SessionProvider/context
 * populated at login), e.g. `return useSession().user?.permissions.includes(p)`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub ignores the arg until real auth lands
export function useCan(_permission: string): boolean {
  return false; // no client session yet → hide gated UI
}
