"use client";

import { useSyncExternalStore } from "react";
import { Heebo } from "next/font/google";
import { TriangleAlertIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { defaultLocale, localeDirection, locales, type Locale } from "@/i18n/config";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "900"],
});

/**
 * Root error boundary — replaces the entire root layout when an uncaught error
 * escapes it, so it must render its own <html>/<body> and cannot use next-intl
 * or the theme provider. The inline script mirrors the theme provider's
 * no-flash cookie read (dark default, like the layout), and the locale is read
 * from the URL prefix after mount (Hebrew default). Strings live here because
 * the intl provider is gone by the time this renders.
 */

// Keep in sync with ThemeProvider's noFlashScript (components/theme-provider.tsx).
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=([^;]*)/);var s=m?decodeURIComponent(m[1]):'dark';if(s!=='light'&&s!=='dark'&&s!=='system')s='dark';var t=s==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):s;var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;

const STRINGS: Record<Locale, { title: string; hint: string; retry: string; home: string }> = {
  he: {
    title: "משהו השתבש",
    hint: "אירעה שגיאה לא צפויה. אפשר לנסות שוב, ואם זה חוזר על עצמו — לחזור לדף הבית.",
    retry: "לנסות שוב",
    home: "לדף הבית",
  },
  en: {
    title: "Something went wrong",
    hint: "An unexpected error occurred. Try again, and if it keeps happening, head back home.",
    retry: "Try again",
    home: "Go home",
  },
};

function subscribeNever(): () => void {
  return () => undefined;
}

function getLocaleFromUrl(): Locale {
  const first = window.location.pathname.split("/")[1];
  return (locales as readonly string[]).includes(first) ? (first as Locale) : defaultLocale;
}

function getServerLocale(): Locale {
  return defaultLocale;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The intl context is gone, so recover the locale from the /he|/en prefix.
  // Modeled as an external store (same idiom as the theme provider): the URL
  // cannot change while this boundary is mounted, so subscribe is a no-op.
  const locale = useSyncExternalStore(subscribeNever, getLocaleFromUrl, getServerLocale);

  const t = STRINGS[locale];

  return (
    <html
      lang={locale}
      dir={localeDirection[locale]}
      className={`${heebo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlertIcon className="size-6" aria-hidden />
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-extrabold text-foreground">{t.title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.hint}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={reset} className={buttonVariants({ size: "lg" })}>
                {t.retry}
              </button>
              <a href={`/${locale}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                {t.home}
              </a>
            </div>
            {error.digest && (
              <p className="text-xs text-muted-foreground/70" dir="ltr">
                {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
