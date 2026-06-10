CREATE TABLE "kanbi_digest" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kanbi_digest" ADD CONSTRAINT "kanbi_digest_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digest_board_created_idx" ON "kanbi_digest" USING btree ("board_id","created_at");