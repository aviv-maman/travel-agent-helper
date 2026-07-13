"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Fire a success toast whenever a `useActionState` form action succeeds.
 * Depend on the state OBJECT (a fresh one per dispatch), not `state.ok` —
 * the primitive stays `true` across repeat submits and would never refire.
 * The stable `id` keeps repeat submits (and dev strict-mode double effects)
 * from stacking duplicate toasts.
 */
export function useSuccessToast(state: { ok?: boolean }, message: string, id: string) {
  useEffect(() => {
    if (state.ok) toast.success(message, { id });
  }, [state, message, id]);
}
