CREATE TABLE "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DELETE FROM "household_users";--> statement-breakpoint
DELETE FROM "households";--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "admin_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "join_code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_user_id_active_idx" ON "api_tokens" USING btree ("user_id") WHERE revoked_at IS NULL;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_households_admin_user_id" ON "households" USING btree ("admin_user_id");