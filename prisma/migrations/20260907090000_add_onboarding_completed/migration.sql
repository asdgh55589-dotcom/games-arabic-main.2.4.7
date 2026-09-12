-- D.6-a: account-completion gate.
-- New users must finish onboarding (confirm data, choose username, set
-- password) before entering the site. Existing users are grandfathered
-- (onboardingCompleted = true) so the gate only funnels new signups.
-- Safe additive migration: new column has DEFAULT, backfill is idempotent.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather every pre-existing account (created before this migration).
UPDATE "User" SET "onboardingCompleted" = true WHERE "onboardingCompleted" = false;
