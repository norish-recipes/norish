CREATE TYPE "public"."caldav_item_type" AS ENUM('recipe', 'note');--> statement-breakpoint
CREATE TYPE "public"."caldav_sync_status_enum" AS ENUM('pending', 'synced', 'failed', 'removed');--> statement-breakpoint
CREATE TABLE "user_caldav_config" (
	"user_id" text PRIMARY KEY NOT NULL,
	"server_url_enc" text NOT NULL,
	"username_enc" text NOT NULL,
	"password_enc" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"breakfast_time" text DEFAULT '08:00-09:00' NOT NULL,
	"lunch_time" text DEFAULT '12:00-13:00' NOT NULL,
	"dinner_time" text DEFAULT '18:00-19:00' NOT NULL,
	"snack_time" text DEFAULT '15:00-15:30' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caldav_sync_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"item_type" "caldav_item_type" NOT NULL,
	"planned_item_id" uuid,
	"event_title" text NOT NULL,
	"sync_status" "caldav_sync_status_enum" DEFAULT 'pending' NOT NULL,
	"caldav_event_uid" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" varchar(500),
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_caldav_sync_user_item" UNIQUE("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "user_caldav_config" ADD CONSTRAINT "user_caldav_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caldav_sync_status" ADD CONSTRAINT "caldav_sync_status_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_caldav_sync_user_status" ON "caldav_sync_status" USING btree ("user_id","sync_status");--> statement-breakpoint
CREATE INDEX "idx_caldav_sync_status_retry" ON "caldav_sync_status" USING btree ("sync_status","retry_count","last_sync_at");