-- Add Cloudinary public IDs for user avatars/banners (SA-1).
-- Additive only, no data loss. Nullable; existing rows keep NULL until next upload.
-- Old Supabase URLs in avatarUrl/bannerUrl are left untouched.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarPublicId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannerPublicId" TEXT;
