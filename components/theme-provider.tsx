"use client";

import * as React from "react";
import { useServerInsertedHTML } from "next/navigation";
import { THEME_COOKIE, THEME_MAX_AGE, isTheme, type Theme } from "@/lib/theme";
import { readUserCookie } from "@/lib/auth/public-user";
import { updateTheme } from "@/lib/auth/actions";

type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (_theme: Theme) => void;
};

const THEME_EVENT = "themechange";
const CHANNEL = "theme";

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

// --- persisted preference (a readable cookie), modeled as an external store ---

function readThemeCookie(): Theme | null {
  const match = document.cookie.match(/(?:^|;\s*)theme=([^;]*)/);
  const value = match ? decodeURIComponent(match[1]) : "";
  return isTheme(value) ? value : null;
}

function writeThemeCookie(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_MAX_AGE}; samesite=lax`;
}

function subscribeTheme(callback: () => void) {
  // Same-tab updates via a custom event; cross-tab via BroadcastChannel (cookies
  // fire no change event of their own).
  window.addEventListener(THEME_EVENT, callback);
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener("message", callback);
  }
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    channel?.close();
  };
}

// --- system color-scheme preference, also an external store ---------------

function subscribeSystem(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystem(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/**
 * Inline script run before hydration to set the theme class on <html> from the
 * cookie, so the first paint already matches the stored preference (no flash).
 */
function noFlashScript(defaultTheme: Theme) {
  return `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=([^;]*)/);var s=m?decodeURIComponent(m[1]):'${defaultTheme}';if(s!=='light'&&s!=='dark'&&s!=='system')s='${defaultTheme}';var t=s==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):s;var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;
}

function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: noFlashScript(defaultTheme) }} />
  ));

  const getTheme = React.useCallback(
    (): Theme => readThemeCookie() ?? defaultTheme,
    [defaultTheme],
  );
  const getServerTheme = React.useCallback(() => defaultTheme, [defaultTheme]);

  // useSyncExternalStore reads the server snapshot during hydration and swaps
  // to the client value right after — no mounted flag, no hydration mismatch.
  const theme = React.useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const system = React.useSyncExternalStore(
    subscribeSystem,
    getSystem,
    () => "dark" as ResolvedTheme,
  );

  const resolvedTheme: ResolvedTheme = theme === "system" ? system : theme;

  // Mirror the resolved theme onto <html>. This syncs an external system (the
  // DOM) rather than React state, so it belongs in an effect.
  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = React.useCallback((next: Theme) => {
    writeThemeCookie(next);
    window.dispatchEvent(new Event(THEME_EVENT));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage(next);
      channel.close();
    }
    // Persist to the DB (cross-device) — only when signed in.
    if (readUserCookie()) void updateTheme(next);
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeHotkey />
      {children}
    </ThemeContext.Provider>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/** Press "d" to flip between light and dark (ignored while typing). */
function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "d") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [resolvedTheme, setTheme]);

  return null;
}

function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    return { theme: "system", resolvedTheme: "dark", setTheme: () => undefined };
  }
  return ctx;
}

export { ThemeProvider, useTheme };
