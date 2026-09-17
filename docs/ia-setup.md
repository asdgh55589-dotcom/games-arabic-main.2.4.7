# Internet Archive Setup Guide (P1 — ENABLED)

File uploads for mods stream to the Internet Archive via its S3-compatible
gateway (`https://s3.us.archive.org`). Server code: `src/lib/ia.ts`.
API: `src/app/api/storage/ia/{sign,relay,complete}/route.ts`.
Client: `src/components/creator/ia-uploader.tsx`.

## 1. Create an account on archive.org

Sign up at https://archive.org/account/login.createaccount.php and verify
your email. Lending/upload privileges may take a short while for new
accounts.

## 2. Get S3 keys

Visit https://archive.org/account/s3.php while logged in. You will see:

- **Access key** → `IA_ACCESS_KEY`
- **Secret key** → `IA_SECRET_KEY`

Keep both server-only. Never prefix them with `NEXT_PUBLIC_`.

## 3. Create the identifier (collection item)

The app uploads every file as an object inside ONE shared item
(bucket) whose name is `IA_IDENTIFIER` (default `games-arabic-mods`).

1. Go to https://archive.org/upload and upload any small placeholder file.
2. Name the item exactly your `IA_IDENTIFIER`.
3. Set its collection to `opensource` (matches `IA_COLLECTION` default)
   and mediatype to `data`/`texts` per your preference.
4. Publish the item. The first server-relay upload also auto-creates the
   item when `x-archive-auto-make-bucket:1` is accepted.

## 4. Add keys to `.env.local` (never `.env` / never commit)

```bash
IA_ENABLED="true"
IA_ACCESS_KEY="..."
IA_SECRET_KEY="..."
IA_IDENTIFIER="games-arabic-mods"
NEXT_PUBLIC_IA_ENABLED="true"
# optional:
# IA_COLLECTION="opensource"
# IA_S3_ENDPOINT="https://s3.us.archive.org"
# IA_S3_REGION="us-east-1"
# NEXT_PUBLIC_IA_UPLOAD_MODE="direct"   # or "relay" (server-stream fallback)
```

Variable names must match `getIaConfig()` in `src/lib/ia.ts` exactly.

## 5. Restart the server

```bash
bun run dev   # or restart your production process
```

Verify: open a creator mod form → files section shows the IA uploader
instead of the "soon" badge. Upload a small `.zip` in **relay** mode
first (works behind any firewall), then try **direct** mode:

- Direct mode signs a header-based SigV4 PUT server-side; the browser
  echoes the headers on a raw PUT to `s3.us.archive.org`.
- If direct mode returns 403 from IA, switch the client to relay:
  `NEXT_PUBLIC_IA_UPLOAD_MODE="relay"` and restart.

## File management

- Admins (all files): `/admin/files`
- Creators (own files only): `/creator/files`
- List APIs: `GET /api/admin/files`, `GET /api/creator/files`
- Delete API: `DELETE /api/admin/files/[id]` (admin: any file;
  creator-via-admin-route: own files only).

Every finished upload writes an `UploadAsset` row (`provider: 'ia'`,
`storageKey: '<identifier>/<key>'`) and IA links saved on mods carry
`ModFileLink.provider = 'ia'` + `storageKey`.
