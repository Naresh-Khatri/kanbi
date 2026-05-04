CREATE TABLE "kanbi_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_id" text,
	"type" text NOT NULL,
	"project_id" text,
	"board_id" text,
	"task_id" text,
	"data" jsonb DEFAULT '{}'::jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kanbi_notification" ADD CONSTRAINT "kanbi_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_notification" ADD CONSTRAINT "kanbi_notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_notification" ADD CONSTRAINT "kanbi_notification_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_notification" ADD CONSTRAINT "kanbi_notification_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_notification" ADD CONSTRAINT "kanbi_notification_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "kanbi_notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "kanbi_notification" USING btree ("user_id","read_at");