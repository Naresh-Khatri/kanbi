CREATE TABLE "kanbi_board_seen" (
	"user_id" text NOT NULL,
	"board_id" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_board_seen_user_id_board_id_pk" PRIMARY KEY("user_id","board_id")
);
--> statement-breakpoint
CREATE TABLE "kanbi_task_seen" (
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_task_seen_user_id_task_id_pk" PRIMARY KEY("user_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "kanbi_task_attachment" ADD COLUMN "comment_id" text;--> statement-breakpoint
ALTER TABLE "kanbi_task_attachment" ADD COLUMN "via_agent" text;--> statement-breakpoint
ALTER TABLE "kanbi_board_seen" ADD CONSTRAINT "kanbi_board_seen_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_board_seen" ADD CONSTRAINT "kanbi_board_seen_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_seen" ADD CONSTRAINT "kanbi_task_seen_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_seen" ADD CONSTRAINT "kanbi_task_seen_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_task_attachment" ADD CONSTRAINT "kanbi_task_attachment_comment_id_kanbi_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."kanbi_comment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_task_created_idx" ON "kanbi_activity" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_key_uq" ON "kanbi_task_attachment" USING btree ("key");