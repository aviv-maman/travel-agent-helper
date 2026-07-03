/**
 * Theme is stored in a **readable** (non-httpOnly) cookie so it survives across
 * sessions and — for signed-in users — is seeded from the DB (`users.themePref`)
 * at login, giving cross-device sync. The client applies it (no-flash script +
 * ThemeProvider); the server never reads it during render, so pages stay static.
 */
export const THEME_COOKIE = "theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}
