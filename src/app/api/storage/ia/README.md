# Internet Archive adapter — DIAGNOSTICS RECORD + OPERATOR GUIDE

> Phase 2.1 status: **DISABLED** (`IA_ENABLED=false` + `NEXT_PUBLIC_IA_ENABLED=false`).
> Code is kept for future use. Do NOT enable until the checklist at the
> bottom passes with ONE real staging upload per mode.

## Live diagnostic facts (staging-tested, proven — do not re-litigate)

| # | Attempt | Result |
|---|---------|--------|
| 1 | Query-presigned SigV4 PUT (`X-Amz-*` in URL, `s3.us.archive.org`) | **403 `InvalidAccessKeyId`** — IA does not accept query-string SigV4 |
| 2 | S3 Multipart Upload (`CreateMultipartUpload`) | **404** — not implemented on the IA gateway (OLD finding — see #7) |
| 3 | Tus protocol (`tus-resumable` handshake) | **Unsupported** — no tus endpoint |
| 4 | `Content-Range` append (`PUT` with range) | **Overwrite-only** — range appends do not concatenate |
| 5 | `Transfer-Encoding: chunked` (streaming without length) | **411 Length Required** — IA demands `Content-Length` |
| 6 | Header-based SigV4 (server-signed `Authorization` header, client echoes headers + PUTs raw bytes) | **UNTESTED** — the remaining direct-mode candidate |
| 7 | S3 multipart **with LOW auth + `x-archive-auto-make-bucket:1`** (new diagnostics) | **WORKS** — initiate(`?uploads`)→UploadId, part PUTs, complete, byte-level resume. Supersedes #2 for the LOW-auth path. Query-presigned SigV4 stays dead (#1) → browser can NEVER sign parts; all part traffic goes through the server proxy (`/api/ia/*`). |

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

## SAFE multipart (per-part server proxy) — DECISION (a)

Query-presigned SigV4 is dead (#1), so the browser can never talk to IA
directly. Two proxy architectures were considered:

- **(a) Server per-part streaming proxy** (`/api/ia/initiate|part|complete|abort|status`):
  Uppy Dashboard → 5MB chunks → our route streams each part to IA with LOW
  auth (constant memory, never disk). Reuses `requireCreatorStudio` + the
  quota engine; no new infrastructure; no secret spread.
- **(b) CF Worker per-part proxy** (extend `workers/image-proxy`): rejected —
  5MB POST bodies through Workers could not be verified against this
  account's plan limits, and (b) duplicates the IA secret into Worker env +
  adds a JWT-on-edge auth layer and a second deploy pipeline.

**(a) chosen.** Journal: `IaMultipartUpload` (`uploadId` unique, `parts`
= `{partNumber: md5hex}`, status `initiated|parts|complete|aborted`) —
resume re-reads the journal, uploaded parts are never re-sent. md5 is
computed client-side per part (vendored `src/lib/md5.ts`, RFC vectors
tested); the server re-verifies with `node:crypto` and rejects mismatches
(IA returns no ETag — the mismatch reject is the only corruption signal).
Complete sends quoted md5s as part ETags (S3 whole-part ETags ARE md5) and
polls `GET /metadata` up to 120s. Abort cleans IA (best-effort) + journal.
Quota (2GB/file, 10/day, 20GB total) is gated at initiate AND re-checked at
complete. `IA_ENABLED` stays fail-closed; flip via env only after the
checklist below gains a multipart proof line.

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
- [ ] ONE real staging upload succeeds via **multipart** mode
      (`NEXT_PUBLIC_IA_UPLOAD_MODE=multipart`: initiate → 5MB parts with
      pause + resume → complete assembles → metadata shows the file →
      `IaMultipartUpload` row is `complete` with the archive.org URL).
- [ ] Only then mirror the flags to production.

## If BOTH modes fail

Owner-approved fallback: **R2 buffer architecture** — browser uploads to
R2 (presigned S3 PUTs, fully supported there) → background job copies
R2 → IA with server-side credentials (no browser/presign/CORS constraints
at all) → `complete` records provider `ia` with the archive.org URL.
`ModFileLink.provider` + `UploadAsset` already model this; no schema change
needed. Estimate on request — NOT built in Phase 2.1.
