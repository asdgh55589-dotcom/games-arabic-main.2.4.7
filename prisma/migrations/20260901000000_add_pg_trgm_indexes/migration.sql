-- Enable pg_trgm extension for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes for fast LIKE/contains queries
CREATE INDEX IF NOT EXISTS idx_user_username_trgm
  ON "User" USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_email_trgm
  ON "User" USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_display_name_trgm
  ON "User" USING gin ("displayName" gin_trgm_ops);
