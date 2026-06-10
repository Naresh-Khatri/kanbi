-- Per-project ticket numbering (Jira-style "KEY-123").
-- Columns are added nullable, backfilled from existing data, then constrained.

-- 1. New columns (nullable for now so existing rows survive the ADD). --
ALTER TABLE "kanbi_project" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "kanbi_project" ADD COLUMN "task_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD COLUMN "number" integer;--> statement-breakpoint

-- 2. Derive a starting key from each project name: initials of the first words
--    (e.g. "Marketing Site" -> "MS"), else the leading letters of one word. --
UPDATE "kanbi_project" AS p
SET "key" = d.base
FROM (
  SELECT
    pr.id,
    CASE
      WHEN length(w.initials) >= 2 THEN left(w.initials, 4)
      ELSE left(regexp_replace(upper(pr.name), '[^A-Z0-9]', '', 'g'), 3)
    END AS base
  FROM "kanbi_project" pr
  LEFT JOIN LATERAL (
    SELECT string_agg(left(tok, 1), '') AS initials
    FROM regexp_split_to_table(upper(pr.name), '\s+') AS tok
    WHERE tok ~ '^[A-Z0-9]'
  ) w ON true
) d
WHERE p.id = d.id;--> statement-breakpoint

-- 3. Normalize: non-empty, must start with a letter. --
UPDATE "kanbi_project" SET "key" = 'PRJ' WHERE "key" IS NULL OR "key" = '';--> statement-breakpoint
UPDATE "kanbi_project" SET "key" = 'P' || "key" WHERE "key" !~ '^[A-Z]';--> statement-breakpoint

-- 4. Dedupe keys within an owner: keep the oldest per (owner,key), and give
--    every later collision the next free "KEY", "KEY2", "KEY3"… probing the
--    live table so we never land on an already-taken suffix. --
DO $$
DECLARE
  r record;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT id, "owner_id", "key" AS base
    FROM (
      SELECT id, "owner_id", "key",
        row_number() OVER (
          PARTITION BY "owner_id", "key" ORDER BY "created_at", id
        ) AS rn
      FROM "kanbi_project"
    ) ranked
    WHERE ranked.rn > 1
  LOOP
    n := 2;
    LOOP
      candidate := r.base || n::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "kanbi_project"
        WHERE "owner_id" = r."owner_id" AND "key" = candidate
      );
      n := n + 1;
    END LOOP;
    UPDATE "kanbi_project" SET "key" = candidate WHERE id = r.id;
  END LOOP;
END $$;--> statement-breakpoint

-- 5. Number existing tasks per board, oldest first. --
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY "board_id" ORDER BY "created_at", id
    ) AS rn
  FROM "kanbi_task"
)
UPDATE "kanbi_task" t
SET "number" = r.rn
FROM ranked r
WHERE t.id = r.id;--> statement-breakpoint

-- 6. Seed each project's counter with the highest number already issued. --
UPDATE "kanbi_project" p
SET "task_counter" = COALESCE(m.max_num, 0)
FROM "kanbi_board" b
LEFT JOIN (
  SELECT "board_id", max("number") AS max_num
  FROM "kanbi_task"
  GROUP BY "board_id"
) m ON m."board_id" = b.id
WHERE b."project_id" = p.id;--> statement-breakpoint

-- 7. Now enforce NOT NULL + uniqueness. --
ALTER TABLE "kanbi_project" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "kanbi_task" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_owner_key_uq" ON "kanbi_project" USING btree ("owner_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "task_board_number_uq" ON "kanbi_task" USING btree ("board_id","number");
