import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin()

/**
 * Same-origin reverse proxy to the Python backend (docs/backend-overview.md
 * §Topology). The browser talks to `/api/ai/*` on OUR origin; Vercel/Next
 * transparently forwards to the backend, so:
 *   - the httpOnly `session` cookie rides along and the backend validates it
 *     against the shared DB (no CORS, no service key in the browser), and
 *   - the SSE stream from POST /ai/chat flows straight through.
 * The app still has no API routes — this is config, not code. Rewrites are
 * resolved at build time, so `BACKEND_URL` must be set in the deploy env; when
 * it's unset (local dev without the backend) no rewrite is added and the AI
 * chat falls back to its mock mode.
 */
const backend = process.env.BACKEND_URL?.trim().replace(/\/$/, "")

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backend) return []
    return [{ source: "/api/ai/:path*", destination: `${backend}/ai/:path*` }]
  },
}

export default withNextIntl(nextConfig)
