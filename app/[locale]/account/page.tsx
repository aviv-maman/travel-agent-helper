import { redirect } from "next/navigation";

/** /account → its first tab. */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/account/profile`);
}
