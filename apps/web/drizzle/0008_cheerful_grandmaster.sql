CREATE TYPE "public"."kanbi_project_status" AS ENUM('active', 'on_hold');--> statement-breakpoint
CREATE TABLE "kanbi_today_item" (
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"position" real NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_today_item_user_id_task_id_pk" PRIMARY KEY("user_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "kanbi_project" ADD COLUMN "status" "kanbi_project_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD COLUMN "estimate_pomodoros" integer;--> statement-breakpoint
ALTER TABLE "kanbi_today_item" ADD CONSTRAINT "kanbi_today_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_today_item" ADD CONSTRAINT "kanbi_today_item_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "today_item_user_idx" ON "kanbi_today_item" USING btree ("user_id");