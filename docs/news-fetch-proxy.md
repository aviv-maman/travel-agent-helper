# News fetch-proxy contract

A few Hebrew publishers sit behind a WAF (Cloudflare for **c14** and **maariv**, Imperva for **israelhayom**) that **blocks datacenter/cloud IPs** — so their fetches succeed from a residential IP (local dev) but return `403`/a challenge page from our production host (Vercel, US). `fetchSource` then silently drops them.

The fix: in production, fetch *those* sources through a small proxy running on an **allowed IP** (ideally Israeli). This document is the contract that proxy must honor. It is deliberately tiny and can live in the same separate Python backend as the OAuth service ([auth-backend-contract.md](./auth-backend-contract.md)).

## How the Next app uses it

- `lib/news.ts` marks the blocked sources `proxied: true`. When `NEWS_FETCH_PROXY` is set, `proxiedUrl()` rewrites those sources' fetches (listing pages **and** the per-article `og:image` fetches) to go through the proxy; otherwise it fetches the origin directly.
- Unset locally → direct fetch (works from a residential IP), so dev is unaffected. Set it only in the production environment.
- Adding a newly-blocked source later is a one-line `proxied: true` in `lib/news.ts` — no backend change needed, because the proxy is generic over the URL.

## The endpoint

```
GET {NEWS_FETCH_PROXY}?url=<url-encoded absolute origin URL>
```
`NEWS_FETCH_PROXY` is the **full** endpoint (e.g. `https://your-proxy.example.com/fetch`); the Next side appends `?url=…` (or `&url=…` if the base already has a query).

Behavior:
- Fetch `url` server-side with browser-like headers (see below) and a timeout, follow redirects.
- On upstream `2xx`: respond **`200`** with the **raw upstream body** (bytes/text passed through). Content-type doesn't matter — the Next parsers pick RSS vs HTML themselves — but echoing it is fine.
- On upstream non-2xx / timeout / error: respond with a **non-200** status. The Next side treats any non-200 as "source unavailable" and drops it gracefully.

## Security — this must NOT be an open proxy

`?url=` is an SSRF / open-relay risk if unrestricted. **Allowlist the hostnames** it will fetch; reject everything else with `403`. Current allowlist:

```
www.israelhayom.co.il   israelhayom.co.il
www.c14.co.il           c14.co.il
www.maariv.co.il        maariv.co.il
```
Also require `https`, block redirects to non-allowlisted hosts, and cap the response size. Optionally add a shared secret header (`X-Proxy-Key`) that Next sends, so only our app can use it.

## Reference implementation (FastAPI)

```python
# main.py
import httpx
from urllib.parse import urlparse
from fastapi import FastAPI, Query, Response, HTTPException

ALLOWED_HOSTS = {
    "www.israelhayom.co.il", "israelhayom.co.il",
    "www.c14.co.il", "c14.co.il",
    "www.maariv.co.il", "maariv.co.il",
}
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "he,en;q=0.9",
}
MAX_BYTES = 5 * 1024 * 1024
app = FastAPI()

@app.get("/fetch")
async def fetch(url: str = Query(...)):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise HTTPException(status_code=403, detail="host not allowed")
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            r = await client.get(url, headers=BROWSER_HEADERS)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="upstream error")
    body = r.content[:MAX_BYTES]
    # Pass through only the upstream's success/failure; body is opaque to us.
    return Response(content=body, status_code=r.status_code,
                    media_type=r.headers.get("content-type", "text/plain"))

@app.get("/healthz")
def healthz():
    return {"ok": True}
```
```
# requirements.txt
fastapi
uvicorn[standard]
httpx
```
Run locally: `uvicorn main:app --port 8000` → test `http://localhost:8000/fetch?url=https%3A%2F%2Fwww.c14.co.il%2Farchive%2F55128`.

## Deploy — the IP is the whole point

The proxy only helps if **its** outbound IP is allowed. A US/EU cloud IP may hit the *same* block. Before wiring `NEWS_FETCH_PROXY`, confirm the host's IP is allowed by fetching the three URLs from it and checking for `200` + tens of KB (not `403`/`503`/a tiny "Just a moment…" page). See the "test-first" steps in the PR / chat.
