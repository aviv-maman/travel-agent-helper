import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * Smart landing: signed-in users go to their personal dashboard; anonymous
 * visitors get the public suppliers page (public browsing is unchanged).
 */
export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  redirect(`/${locale}/${user ? "dashboard" : "suppliers"}`);
}
