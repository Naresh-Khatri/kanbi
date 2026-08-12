CREATE TYPE "public"."kanbi_column_category" AS ENUM('backlog', 'unstarted', 'started', 'completed', 'canceled');--> statement-breakpoint
ALTER TABLE "kanbi_column" ADD COLUMN "category" "kanbi_column_category" DEFAULT 'unstarted' NOT NULL;
--> statement-breakpoint
UPDATE "kanbi_column"
SET "category" = CASE
	WHEN lower(trim("name")) IN ('done', 'complete', 'completed', 'shipped', 'released', 'closed') THEN 'completed'::"kanbi_column_category"
	WHEN lower(trim("name")) IN ('canceled', 'cancelled', 'wont fix', 'won''t fix') THEN 'canceled'::"kanbi_column_category"
	WHEN lower(trim("name")) IN ('in progress', 'doing', 'started', 'in review', 'review') THEN 'started'::"kanbi_column_category"
	WHEN lower(trim("name")) IN ('backlog', 'icebox', 'triage') THEN 'backlog'::"kanbi_column_category"
	ELSE 'unstarted'::"kanbi_column_category"
END;
