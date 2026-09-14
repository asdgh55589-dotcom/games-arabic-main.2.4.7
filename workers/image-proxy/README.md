# Image Proxy Worker (`games-arabic-image-proxy`)

Edge cache in front of FreeImage image URLs. The main app requests uploads
via `/api/storage/upload-image`, which returns `{ url, originalUrl,
wrappedUrl }` — `wrappedUrl` points here when `IMG_WORKER_DOMAIN` is set,
otherwise the app falls back to the original URL (zero-downtime rollout).

## How it works

`GET https://<worker>/img/<base64url-of-upstream-url>`

1. Decode + validate path (400 on garbage).
2. Upstream must be `http(s)` and on the allowlist
   (`iili.io`, `freeimage.host` + optional `ALLOWED_UPSTREAM_HOSTS`) —
   anything else is 403 (SSRF guard).
3. `caches.default` lookup → **HIT** served immediately with
   `Cache-Control: public, max-age=31536000, immutable` + ETag passthrough.
4. **MISS** fetches upstream (25s timeout), requires `image/*`
   content-type and ≤ 70MB, stores via `ctx.waitUntil(cache.put(...))`
   so the client never waits for the edge write.

## Deploy (owner steps)

```bash
cd workers/image-proxy
npx wrangler login
npx wrangler deploy
```

Then attach a custom domain (recommended — stable URLs):

1. Cloudflare dashboard → Workers & Pages → `games-arabic-image-proxy` →
   Settings → Domains & Routes → Add → Route:
   `img.gamesarabic.com/*` (zone: your domain).
2. DNS is created automatically (proxied `A`/`AAAA` to Workers).
3. Main app env: `IMG_WORKER_DOMAIN=img.gamesarabic.com`, redeploy app.
4. Verify: `curl -I https://img.gamesarabic.com/img/<b64>` twice —
   first `X-Cache: MISS`, second `X-Cache: HIT`.

Local check: `npx wrangler dev` then
`curl http://localhost:8787/img/<base64url-of-an-iili.io-url>`.

## Rollback

Unset `IMG_WORKER_DOMAIN` (or empty) in the app env — every caller falls
back to original FreeImage URLs instantly. No data migration needed.
