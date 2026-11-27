CREATE TYPE "public"."kanbi_milestone_status" AS ENUM('upcoming', 'active', 'closed');--> statement-breakpoint
CREATE TABLE "kanbi_milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_at" timestamp with time zone,
	"status" "kanbi_milestone_status" DEFAULT 'upcoming' NOT NULL,
	"position" real NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kanbi_milestone" ADD CONSTRAINT "kanbi_milestone_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestone_board_position_idx" ON "kanbi_milestone" USING btree ("board_id","position");--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD COLUMN "milestone_id" text;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD CONSTRAINT "kanbi_task_milestone_id_kanbi_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."kanbi_milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_milestone_idx" ON "kanbi_task" USING btree ("milestone_id");--> statement-breakpoint
ALTER TABLE "kanbi_board_view_preference" ADD COLUMN "milestone_filter" text;
