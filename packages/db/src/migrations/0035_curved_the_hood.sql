CREATE TYPE "public"."mutation_receipt_status" AS ENUM('processing', 'completed');--> statement-breakpoint
CREATE TABLE "mutation_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"procedure_path" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"status" "mutation_receipt_status" DEFAULT 'processing' NOT NULL,
	"processing_lease_until" timestamp with time zone,
	"response_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_principal_id_user_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mutation_receipt_principal_operation_idx" ON "mutation_receipts" USING btree ("principal_id","operation_id");--> statement-breakpoint
CREATE INDEX "mutation_receipt_expiry_idx" ON "mutation_receipts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mutation_receipt_status_lease_idx" ON "mutation_receipts" USING btree ("status","processing_lease_until");