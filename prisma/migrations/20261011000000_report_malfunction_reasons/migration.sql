-- game-page-design: malfunction report reasons for mod reports (dead links, broken files, ...).
-- Additive only: legacy values (spam, inappropriate, ...) stay for existing rows + comment/user reports.
-- Applied via `prisma db execute` + `migrate resolve --applied` (ADD VALUE cannot run in a txn).
DO $$ BEGIN
  ALTER TYPE "ReportReason" ADD VALUE 'dead_links';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "ReportReason" ADD VALUE 'broken_files';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "ReportReason" ADD VALUE 'install_issue';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "ReportReason" ADD VALUE 'outdated_info';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "ReportReason" ADD VALUE 'outdated_translation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "ReportReason" ADD VALUE 'version_mismatch';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
