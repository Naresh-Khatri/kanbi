CREATE TABLE "kanbi_project_invite_link" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"token" text NOT NULL,
	"role" "kanbi_project_role" DEFAULT 'viewer' NOT NULL,
	"max_uses" integer NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_project_invite_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "kanbi_project_member" ADD COLUMN "joined_via_link_id" text;--> statement-breakpoint
ALTER TABLE "kanbi_project_invite_link" ADD CONSTRAINT "kanbi_project_invite_link_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_project_invite_link" ADD CONSTRAINT "kanbi_project_invite_link_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_invite_link_project_idx" ON "kanbi_project_invite_link" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "kanbi_project_member" ADD CONSTRAINT "kanbi_project_member_joined_via_link_id_kanbi_project_invite_link_id_fk" FOREIGN KEY ("joined_via_link_id") REFERENCES "public"."kanbi_project_invite_link"("id") ON DELETE set null ON UPDATE no action;