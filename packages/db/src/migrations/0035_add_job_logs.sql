-- Job status enum
DO $$ BEGIN
  CREATE TYPE "public"."job_status" AS ENUM('queued', 'active', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Job step status enum
DO $$ BEGIN
  CREATE TYPE "public"."job_step_status" AS ENUM('pending', 'active', 'completed', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL,
  "queue_name" text NOT NULL,
  "status" "job_status" DEFAULT 'queued' NOT NULL,
  "user_id" text,
  "recipe_id" text,
  "description" text,
  "input" jsonb,
  "steps" jsonb DEFAULT '[]'::jsonb,
  "result" jsonb,
  "error" text,
  "ai_model" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "job_logs_queue_name_idx" ON "job_logs" USING btree ("queue_name");
CREATE INDEX IF NOT EXISTS "job_logs_status_idx" ON "job_logs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "job_logs_user_id_idx" ON "job_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "job_logs_recipe_id_idx" ON "job_logs" USING btree ("recipe_id");
CREATE INDEX IF NOT EXISTS "job_logs_created_at_idx" ON "job_logs" USING btree ("created_at");
