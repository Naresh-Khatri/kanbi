CREATE TABLE "kanbi_board_view_preference" (
	"board_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sorts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hidden_column_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collapsed_column_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_column_id" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "kanbi_board_view_preference_board_id_user_id_pk" PRIMARY KEY("board_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "kanbi_board_view_preference" ADD CONSTRAINT "kanbi_board_view_preference_board_id_kanbi_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanbi_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_board_view_preference" ADD CONSTRAINT "kanbi_board_view_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;