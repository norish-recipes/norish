CREATE TABLE "api_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"procedure" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text,
	"duration_ms" integer,
	"success" text DEFAULT 'true' NOT NULL,
	"error_code" text,
	"error_message" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_logs_procedure_idx" ON "api_logs" USING btree ("procedure");--> statement-breakpoint
CREATE INDEX "api_logs_user_id_idx" ON "api_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_logs_created_at_idx" ON "api_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_logs_success_idx" ON "api_logs" USING btree ("success");