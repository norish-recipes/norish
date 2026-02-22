CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_tokens" RENAME TO "apikey";--> statement-breakpoint
TRUNCATE TABLE "apikey";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "providerAccountId" TO "provider_account_id";--> statement-breakpoint
-- Convert expires_at from integer (unix timestamp seconds) to timestamp
ALTER TABLE "account" ALTER COLUMN "expires_at" TYPE timestamp USING to_timestamp("expires_at");--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "expires_at" TO "access_token_expires_at";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "last_used_at" TO "updated_at";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "sessionTokenHash" TO "token";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "expires" TO "expires_at";--> statement-breakpoint
-- Convert emailVerified from timestamp to boolean (not null = true, null = false)
ALTER TABLE "user" ADD COLUMN "email_verified_new" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user" SET "email_verified_new" = ("emailVerified" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "emailVerified";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "email_verified_new" TO "email_verified";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apikey" DROP CONSTRAINT "api_tokens_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_userId_user_id_fk";
--> statement-breakpoint
DROP INDEX "account_user_provider_unique";--> statement-breakpoint
DROP INDEX "api_tokens_token_hash_idx";--> statement-breakpoint
DROP INDEX "api_tokens_user_id_active_idx";--> statement-breakpoint
-- Set defaults for any NULL values before adding NOT NULL constraint
UPDATE "user" SET "email_enc" = '' WHERE "email_enc" IS NULL;--> statement-breakpoint
UPDATE "user" SET "name_enc" = '' WHERE "name_enc" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_enc" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "name_enc" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "refresh_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "start" text;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "prefix" text;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "refill_interval" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "refill_amount" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "last_refill_at" timestamp;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "remaining" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "rate_limit_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "rate_limit_time_window" integer DEFAULT 86400000;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "rate_limit_max" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "request_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "last_request" timestamp;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "permissions" text;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "metadata" text;--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_pkey";--> statement-breakpoint
TRUNCATE TABLE "session";--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "account" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_user_id_idx" ON "apikey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "session_state";--> statement-breakpoint
ALTER TABLE "apikey" DROP COLUMN "token_hash";--> statement-breakpoint
ALTER TABLE "apikey" DROP COLUMN "revoked_at";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "name_hmac";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "image_hmac";--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE("token");