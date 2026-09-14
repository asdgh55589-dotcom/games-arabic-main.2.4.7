# Image Worker Deployment Guide

## Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI installed (`npm install -g wrangler`)
- Domain configured in Cloudflare DNS

## 1. Login & Deploy

```bash
cd workers/image-proxy
wrangler login
wrangler deploy
```

## 2. DNS Record Setup

In Cloudflare DNS, add a CNAME record:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | img | `<your-worker>.workers.dev` | Proxied (orange cloud) |

## 3. SSL / TLS Configuration

In Cloudflare dashboard → SSL/TLS:

- **Set mode to "Full (Strict)"** — NOT "Flexible"
- "Flexible" breaks Secure cookies and causes redirect loops
- "Full (Strict)" validates the origin certificate end-to-end

## 4. Environment Variable

Set `IMG_WORKER_DOMAIN` in your hosting environment (Vercel/Neon/etc.):

```
IMG_WORKER_DOMAIN=img.gamesarabic.com
```

## 5. Verification

```bash
# Health check — should return HTTP 200
curl -I https://img.gamesarabic.com/__health

# Wrapped image test
curl -I "https://img.gamesarabic.com/img/<base64-encoded-url>"
```

Expected response headers for wrapped images:
```
Cache-Control: public, max-age=31536000, immutable
CDN-Cache-Control: public, max-age=31536000, immutable
```

## 6. CDN Headers

The worker sets immutable caching headers for wrapped images:
- `Cache-Control: public, max-age=31536000, immutable`
- `CDN-Cache-Control: public, max-age=31536000, immutable`

This ensures Cloudflare CDN caches images aggressively (1 year).

## 7. Rollback

If the worker causes issues, remove the environment variable:

```bash
# In your hosting dashboard, delete IMG_WORKER_DOMAIN
# The app falls back to direct URLs automatically
```

No code changes needed — `wrapImageUrl()` returns `null` when unconfigured.
