CREATE TABLE "kanbi_document_favorite" (
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_document_favorite_user_id_document_id_pk" PRIMARY KEY("user_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "kanbi_document_file" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"document_id" text,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploader_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanbi_document_page_link" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	CONSTRAINT "kanbi_document_page_link_source_id_target_id_pk" PRIMARY KEY("source_id","target_id")
);
--> statement-breakpoint
ALTER TABLE "kanbi_document" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "kanbi_document_favorite" ADD CONSTRAINT "kanbi_document_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_favorite" ADD CONSTRAINT "kanbi_document_favorite_document_id_kanbi_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kanbi_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_file" ADD CONSTRAINT "kanbi_document_file_project_id_kanbi_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kanbi_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_file" ADD CONSTRAINT "kanbi_document_file_document_id_kanbi_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kanbi_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_file" ADD CONSTRAINT "kanbi_document_file_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_page_link" ADD CONSTRAINT "kanbi_document_page_link_source_id_kanbi_document_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."kanbi_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanbi_document_page_link" ADD CONSTRAINT "kanbi_document_page_link_target_id_kanbi_document_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."kanbi_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_file_project_idx" ON "kanbi_document_file" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_file_key_uq" ON "kanbi_document_file" USING btree ("key");--> statement-breakpoint
CREATE INDEX "document_page_link_target_idx" ON "kanbi_document_page_link" USING btree ("target_id");
