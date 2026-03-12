ALTER TABLE "account" RENAME COLUMN "user_id" TO "userId";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "provider" TO "providerId";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "provider_account_id" TO "accountId";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "access_token_enc" TO "accessToken";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "refresh_token_enc" TO "refreshToken";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "id_token_enc" TO "idToken";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "access_token_expires_at" TO "accessTokenExpiresAt";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "refresh_token_expires_at" TO "refreshTokenExpiresAt";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "updated_at" TO "updatedAt";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "user_id" TO "userId";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "refill_interval" TO "refillInterval";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "refill_amount" TO "refillAmount";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "last_refill_at" TO "lastRefillAt";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "rate_limit_enabled" TO "rateLimitEnabled";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "rate_limit_time_window" TO "rateLimitTimeWindow";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "rate_limit_max" TO "rateLimitMax";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "request_count" TO "requestCount";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "last_request" TO "lastRequest";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "expires_at" TO "expiresAt";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "apikey" RENAME COLUMN "updated_at" TO "updatedAt";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "user_id" TO "userId";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "expires_at" TO "expiresAt";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "ip_address" TO "ipAddress";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "user_agent" TO "userAgent";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "session" RENAME COLUMN "updated_at" TO "updatedAt";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "email_enc" TO "email";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "name_enc" TO "name";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "image_enc" TO "image";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "email_hmac" TO "emailHmac";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "email_verified" TO "emailVerified";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "is_server_owner" TO "isServerOwner";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "is_server_admin" TO "isServerAdmin";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "updated_at" TO "updatedAt";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "expires_at" TO "expiresAt";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "updated_at" TO "updatedAt";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apikey" DROP CONSTRAINT "apikey_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "account_user_id_idx";--> statement-breakpoint
DROP INDEX "account_provider_unique";--> statement-breakpoint
DROP INDEX "apikey_user_id_idx";--> statement-breakpoint
DROP INDEX "session_user_id_idx";--> statement-breakpoint
DROP INDEX "user_email_hmac_idx";--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "account" USING btree ("providerId","accountId");--> statement-breakpoint
CREATE INDEX "apikey_user_id_idx" ON "apikey" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_hmac_idx" ON "user" USING btree ("emailHmac");