-- Add extensible JSONB preferences column for per-user settings
ALTER TABLE "user"
  ADD COLUMN "preferences" jsonb NULL DEFAULT '{}'::jsonb;
