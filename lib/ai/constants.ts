/**
 * Shared AI-assistant constants — plain values with no imports, safe to pull into
 * both server code and Client Components (and the Edge runtime). See
 * docs/ai-quote-assistant-contract.md.
 */

/** Providers we model in the UI. Anthropic is implemented first (contract §"Provider-agnostic"). */
export const AI_PROVIDERS = ["anthropic"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Default provider shown in the key form until we support more. */
export const DEFAULT_AI_PROVIDER: AiProvider = "anthropic";

/**
 * Non-httpOnly mirror of "this user has an AI key configured", so the client nav
 * can reveal the Assistant link without the root layout reading the session
 * server-side (which would make every public page dynamic). Display-only — the
 * server DAL (`getAiCredential`) is the real gate. Mirrors the USER_COOKIE idea
 * in lib/auth/cookies.ts.
 */
export const AI_ENABLED_COOKIE = "ai_enabled";

/**
 * Dev-only credential mock: when `BACKEND_URL` is unset there is no Python
 * service to encrypt/store keys, so we stash just the last 4 chars here to make
 * the whole flow clickable. httpOnly; never holds the plaintext key. Ignored the
 * moment a real backend is configured.
 */
export const AI_MOCK_KEY_COOKIE = "ai_key_mock";
