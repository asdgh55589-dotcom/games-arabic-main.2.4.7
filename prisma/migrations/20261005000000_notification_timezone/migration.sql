-- P2: quiet hours must be evaluated in the recipient's IANA timezone,
-- not in the server process timezone (which was UTC on Vercel and made
-- every quiet-hours window wrong for the actual reader).
-- NULL = no explicit zone ⇒ the window is computed in UTC, i.e. exactly
-- what the code did before this migration, so existing rows are unchanged.
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
