CREATE TYPE "public"."site_auth_token_type" AS ENUM('header', 'cookie');--> statement-breakpoint
CREATE TABLE "site_auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"value_enc" text NOT NULL,
	"type" "site_auth_token_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_auth_tokens" ADD CONSTRAINT "site_auth_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_site_auth_tokens_user_id" ON "site_auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_site_auth_tokens_user_domain" ON "site_auth_tokens" USING btree ("user_id","domain");