CREATE TABLE "recurring_groceries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"amount" numeric(10, 3),
	"recurrence_rule" text NOT NULL,
	"recurrence_interval" integer DEFAULT 1 NOT NULL,
	"recurrence_weekday" integer,
	"next_planned_for" date NOT NULL,
	"last_checked_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groceries" ADD COLUMN "recurring_grocery_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recurring_groceries_user_id" ON "recurring_groceries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_groceries_next_date" ON "recurring_groceries" USING btree ("next_planned_for");--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_recurring_grocery_id_recurring_groceries_id_fk" FOREIGN KEY ("recurring_grocery_id") REFERENCES "public"."recurring_groceries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_groceries_recurring_grocery_id" ON "groceries" USING btree ("recurring_grocery_id");