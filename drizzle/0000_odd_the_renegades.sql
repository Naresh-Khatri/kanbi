CREATE TYPE "public"."kanbi_project_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."kanbi_task_priority" AS ENUM('urgent', 'high', 'medium', 'low', 'none');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"task_id" text,
	"actor_id" text NOT NULL,
	"verb" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_board" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "kanbi_board_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "kanbi_column" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"position" real NOT NULL,
	"wip_limit" integer,
	"color" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kanbi_board_share" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"created_by_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_board_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "kanbi_checklist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" real NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kanbi_label" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_project" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kanbi_project_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "kanbi_project_role" DEFAULT 'editor' NOT NULL,
	"token" text NOT NULL,
	"invited_by_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_project_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "kanbi_project_member" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "kanbi_project_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "kanbi_project_member_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "kanbi_task" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"column_id" text NOT NULL,
	"position" real NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "kanbi_task_priority" DEFAULT 'none' NOT NULL,
	"reporter_id" text NOT NULL,
	"assignee_id" text,
	"due_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kanbi_task_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploader_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_task_label" (
	"task_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "kanbi_task_label_task_id_label_id_pk" PRIMARY KEY("task_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_activity" ADD CONSTRAINT "kanbi_activity_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_activity" ADD CONSTRAINT "kanbi_activity_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_activity" ADD CONSTRAINT "kanbi_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_board" ADD CONSTRAINT "kanbi_board_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_column" ADD CONSTRAINT "kanbi_column_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_board_share" ADD CONSTRAINT "kanbi_board_share_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_board_share" ADD CONSTRAINT "kanbi_board_share_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_checklist_item" ADD CONSTRAINT "kanbi_checklist_item_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_comment" ADD CONSTRAINT "kanbi_comment_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_comment" ADD CONSTRAINT "kanbi_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_label" ADD CONSTRAINT "kanbi_label_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_project" ADD CONSTRAINT "kanbi_project_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_project_invite" ADD CONSTRAINT "kanbi_project_invite_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_project_invite" ADD CONSTRAINT "kanbi_project_invite_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_project_member" ADD CONSTRAINT "kanbi_project_member_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_project_member" ADD CONSTRAINT "kanbi_project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD CONSTRAINT "kanbi_task_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD CONSTRAINT "kanbi_task_column_id_kanbi_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."kanbi_column"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD CONSTRAINT "kanbi_task_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task" ADD CONSTRAINT "kanbi_task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_attachment" ADD CONSTRAINT "kanbi_task_attachment_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_attachment" ADD CONSTRAINT "kanbi_task_attachment_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_label" ADD CONSTRAINT "kanbi_task_label_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_label" ADD CONSTRAINT "kanbi_task_label_label_id_kanbi_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."kanbi_label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_board_created_idx" ON "kanbi_activity" USING btree ("board_id","created_at");--> statement-breakpoint
CREATE INDEX "column_board_position_idx" ON "kanbi_column" USING btree ("board_id","position");--> statement-breakpoint
CREATE INDEX "board_share_board_idx" ON "kanbi_board_share" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "checklist_task_position_idx" ON "kanbi_checklist_item" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "comment_task_idx" ON "kanbi_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "label_board_idx" ON "kanbi_label" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_owner_slug_uq" ON "kanbi_project" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "project_owner_idx" ON "kanbi_project" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_invite_project_idx" ON "kanbi_project_invite" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_invite_email_idx" ON "kanbi_project_invite" USING btree ("email");--> statement-breakpoint
CREATE INDEX "project_member_user_idx" ON "kanbi_project_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_column_position_idx" ON "kanbi_task" USING btree ("column_id","position");--> statement-breakpoint
CREATE INDEX "task_board_idx" ON "kanbi_task" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "task_assignee_idx" ON "kanbi_task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "attachment_task_idx" ON "kanbi_task_attachment" USING btree ("task_id");