CREATE TABLE "kanbi_mcp_request" (
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kanbi_mcp_request_user_id_client_id_key_pk" PRIMARY KEY("user_id","client_id","key")
);
--> statement-breakpoint
ALTER TABLE "kanbi_mcp_request" ADD CONSTRAINT "kanbi_mcp_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;