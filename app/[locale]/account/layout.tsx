import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireUser, can } from "@/lib/auth";
import { AccountNav } from "@/components/auth/account-nav";

/** Shared shell for the account settings area. Requires login; renders the tabs. */
export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const [canInvites, canUsers] = [await can("invites:manage"), await can("users:manage")];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-2">
      <AccountNav canInvites={canInvites} canUsers={canUsers} />
      {children}
    </div>
  );
}
