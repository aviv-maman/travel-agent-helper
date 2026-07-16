import "server-only";
import { headers } from "next/headers";
import { backendUrl } from "@/lib/ai/backend";

/**
 * Send a transactional email through the Python backend's POST /email/send
 * (docs/email-contract.md). Server-to-server: authenticated with the shared
 * `SERVICE_KEY` (not the session cookie). Best-effort — returns false on any
 * failure (unset config, backend down, provider not wired → 503) so callers can
 * show a neutral message without leaking whether the address exists.
 *
 * NOTE: until Resend is configured on the backend, this always returns false
 * (the endpoint 503s). The flows are built to degrade gracefully until then.
 */
export async function sendTemplateEmail(
  to: string,
  template: "email_verification" | "password_reset" | "security_alert" | "invite",
  locale: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const base = backendUrl();
  const serviceKey = process.env.SERVICE_KEY;
  if (!base || !serviceKey) return false;
  try {
    const res = await fetch(`${base}/email/send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-key": serviceKey },
      body: JSON.stringify({ to, template, locale, data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Absolute origin of the current request, for building links inside emails. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
