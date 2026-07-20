import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Heebo } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PageNav } from "@/components/page-nav";
import { SessionProvider } from "@/components/auth/session-provider";
import { PwaRegister } from "@/components/pwa-register";
import { validateSession } from "@/lib/auth/session";
import { routing, localeDirection, type Locale } from "@/i18n/routing";
import "../globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "900"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Status-bar colour, per light/dark. Next auto-adds the manifest + icon links. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return {
    title: `${t("title")} — ${t("subtitle")}`,
    description: t("subtitle"),
    applicationName: t("title"),
    // Installable web-app metadata (iOS home-screen + full-screen launch).
    appleWebApp: { capable: true, statusBarStyle: "black", title: "סוכני נסיעות" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const dir = localeDirection[locale as Locale];
  const t = await getTranslations({ locale, namespace: "app" });
  // The avatar the user uploaded (nav shows initials until then). Read server-side
  // since the client session mirror cookie carries only name, not the image URL.
  const currentUser = await validateSession();

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProvider defaultTheme="dark">
            <DirectionProvider direction={dir}>
              <SessionProvider>
                <PageNav avatarUrl={currentUser?.avatarUrl ?? null} />
                <main className="mx-auto w-full max-w-5xl p-4">
                  <header className="mb-8">
                    {/* The wordmark replaces the text title; it carries a dark
                        badge background so it reads on both light and dark. */}
                    <h1>
                      <Image
                        src="/brand/wordmark.png"
                        alt="TravelMatrix"
                        width={904}
                        height={280}
                        priority
                        className="h-11 w-auto rounded-lg sm:h-12"
                      />
                    </h1>
                    <p className="mt-2.5 text-sm text-muted-foreground">{t("subtitle")}</p>
                  </header>
                  {children}
                </main>
                <Toaster />
                <PwaRegister />
              </SessionProvider>
            </DirectionProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
