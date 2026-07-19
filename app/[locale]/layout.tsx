import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PageNav } from "@/components/page-nav";
import { SessionProvider } from "@/components/auth/session-provider";
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
                    <h1 className="text-2xl font-extrabold text-foreground">{t("title")}</h1>
                    <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
                  </header>
                  {children}
                </main>
                <Toaster />
              </SessionProvider>
            </DirectionProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
