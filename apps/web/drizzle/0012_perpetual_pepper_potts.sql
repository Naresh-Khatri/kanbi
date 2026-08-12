CREATE TABLE "kanbi_document_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"editor_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_document_task_link" (
	"document_id" text NOT NULL,
	"task_id" text NOT NULL,
	CONSTRAINT "kanbi_document_task_link_document_id_task_id_pk" PRIMARY KEY("document_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "kanbi_document" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"body" text DEFAULT '<p></p>' NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"position" real NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kanbi_document_revision" ADD CONSTRAINT "kanbi_document_revision_document_id_kanbi_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kanbi_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_revision" ADD CONSTRAINT "kanbi_document_revision_editor_id_user_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_task_link" ADD CONSTRAINT "kanbi_document_task_link_document_id_kanbi_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kanbi_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_task_link" ADD CONSTRAINT "kanbi_document_task_link_task_id_kanbi_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanbi_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document" ADD CONSTRAINT "kanbi_document_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document" ADD CONSTRAINT "kanbi_document_parent_id_kanbi_document_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."kanbi_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document" ADD CONSTRAINT "kanbi_document_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document" ADD CONSTRAINT "kanbi_document_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_revision_document_version_uq" ON "kanbi_document_revision" USING btree ("document_id","version");--> statement-breakpoint
CREATE INDEX "document_revision_document_created_idx" ON "kanbi_document_revision" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_task_link_task_idx" ON "kanbi_document_task_link" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "document_project_parent_position_idx" ON "kanbi_document" USING btree ("project_id","parent_id","position");--> statement-breakpoint
CREATE INDEX "document_project_updated_idx" ON "kanbi_document" USING btree ("project_id","updated_at");