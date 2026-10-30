-- 0075 parks links from before 0.25 here; an install that ran 0075 before it did gets the table now.
CREATE TABLE IF NOT EXISTS "parked_name_keyed_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"link" jsonb NOT NULL
);
