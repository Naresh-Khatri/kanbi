CREATE TYPE "public"."kanbi_column_sort_dir" AS ENUM('asc', 'desc');--> statement-breakpoint
CREATE TYPE "public"."kanbi_column_sort_mode" AS ENUM('manual', 'priority', 'assignee', 'dueAt', 'createdAt');--> statement-breakpoint
ALTER TABLE "kanbi_column" ADD COLUMN "sort_mode" "kanbi_column_sort_mode" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "kanbi_column" ADD COLUMN "sort_dir" "kanbi_column_sort_dir" DEFAULT 'asc' NOT NULL;--> statement-breakpoint
ALTER TABLE "kanbi_project" ADD COLUMN "system_prompt" text;