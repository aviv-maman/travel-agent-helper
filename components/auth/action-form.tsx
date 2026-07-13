"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

/**
 * A `<form>` around a void server action (the admin/account table buttons)
 * that surfaces the outcome as a toast — success when the action resolves,
 * error if it throws — instead of the silent default. Server components pass
 * the bound action plus already-translated messages.
 *
 * Actions that redirect are fine: Next performs the navigation and the
 * success toast simply doesn't outlive it.
 */
export function ActionForm({
  action,
  successMessage,
  errorMessage,
  className,
  children,
}: {
  action: (_formData: FormData) => Promise<void>;
  successMessage: string;
  errorMessage: string;
  className?: string;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
      } catch {
        toast.error(errorMessage);
      }
    });
  }

  return (
    <form action={submit} className={className}>
      {children}
    </form>
  );
}
