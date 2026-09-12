# Internet Archive adapter — DIAGNOSTICS RECORD + OPERATOR GUIDE

> Phase 2.1 status: **DISABLED** (`IA_ENABLED=false` + `NEXT_PUBLIC_IA_ENABLED=false`).
> Code is kept for future use. Do NOT enable until the checklist at the
> bottom passes with ONE real staging upload per mode.

## Live diagnostic facts (staging-tested, proven — do not re-litigate)

| # | Attempt | Result |
|---|---------|--------|
| 1 | Query-presigned SigV4 PUT (`X-Amz-*` in URL, `s3.us.archive.org`) | **403 `InvalidAccessKeyId`** — IA does not accept query-string SigV4 |
| 2 | S3 Multipart Upload (`CreateMultipartUpload`) | **404** — not implemented on the IA gateway |
| 3 | Tus protocol (`tus-resumable` handshake) | **Unsupported** — no tus endpoint |
| 4 | `Content-Range` append (`PUT` with range) | **Overwrite-only** — range appends do not concatenate |
| 5 | `Transfer-Encoding: chunked` (streaming without length) | **411 Length Required** — IA demands `Content-Length` |
| 6 | Header-based SigV4 (server-signed `Authorization` header, client echoes headers + PUTs raw bytes) | **UNTESTED** — the remaining direct-mode candidate |

## What this means for the code in this directory

- `sign/` (query-presigned PUT) is **proven dead against current IA**
  (finding #1). Kept for reference; do not enable on its basis.
- `relay/` (server streams with explicit `Content-Length` via AWS SDK
  `PutObjectCommand`) respects finding #5 by construction — no chunked
  encoding is ever used. This is the leading candidate **if** header auth
  works at all.
- `complete/` (server `HeadObject` verify + quota record) is
  transport-agnostic and survives regardless of which upload path wins.
- `upload-file/` (parent) is the future home of the R2-buffer flow.

## Enablement checklist (ALL must pass)

- [ ] ONE real staging upload succeeds via **direct-header** mode
      (server signs `Authorization` header set; browser PUTs raw bytes
      with those exact headers; IA returns 200; `HeadObject` confirms).
- [ ] ONE real staging upload succeeds via **relay** mode
      (`POST /api/storage/ia/relay` → SDK PUT → 200 → `HeadObject`).
- [ ] `IA_IDENTIFIER` item exists with the intended collection
      (create once via archive.org UI; presigned/direct writes land in it).
- [ ] Set `IA_ENABLED=true` + `NEXT_PUBLIC_IA_ENABLED=true` in staging,
      repeat one upload end-to-end from the mod form (IA toggle visible,
      archive.org row badged, usage recorded).
- [ ] Only then mirror the flags to production.

## If BOTH modes fail

Owner-approved fallback: **R2 buffer architecture** — browser uploads to
R2 (presigned S3 PUTs, fully supported there) → background job copies
R2 → IA with server-side credentials (no browser/presign/CORS constraints
at all) → `complete` records provider `ia` with the archive.org URL.
`ModFileLink.provider` + `UploadAsset` already model this; no schema change
needed. Estimate on request — NOT built in Phase 2.1.
