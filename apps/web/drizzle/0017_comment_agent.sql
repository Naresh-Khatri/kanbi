ALTER TABLE "kanbi_comment" ADD COLUMN "agent" text;--> statement-breakpoint
ALTER TABLE "kanbi_comment" ADD COLUMN "agent_client_id" text;--> statement-breakpoint
-- old agent comments carried a "— via <client> (agent)" footer; move it into the columns
WITH footer AS (
	SELECT "id",
		substring("body" from '<p><em>— via (.+?) \(agent\)</em></p>\s*$') AS "client"
	FROM "kanbi_comment"
)
UPDATE "kanbi_comment" c SET
	"agent" = CASE
		WHEN f."client" ILIKE '%claude%' THEN 'claude-code'
		WHEN f."client" ~* 'codex|openai' THEN 'codex'
		WHEN f."client" ILIKE '%antigravity%' THEN 'antigravity'
		WHEN f."client" ~* 'open\s*code' THEN 'opencode'
		WHEN f."client" ILIKE '%cursor%' THEN 'cursor'
		WHEN f."client" ~* 'copilot|vs\s*code|visual studio' THEN 'copilot'
		WHEN f."client" ILIKE '%gemini%' THEN 'gemini-cli'
		WHEN f."client" ILIKE '%kilo%' THEN 'kilo-code'
		WHEN f."client" ILIKE '%cline%' THEN 'cline'
		WHEN f."client" ILIKE '%roo%' THEN 'roo-code'
		WHEN f."client" ~* 'windsurf|codeium' THEN 'windsurf'
		WHEN f."client" ~* '\mamp\M' THEN 'amp'
		WHEN f."client" ILIKE '%junie%' THEN 'junie'
		WHEN f."client" ILIKE '%kiro%' THEN 'kiro'
		WHEN f."client" ILIKE '%qwen%' THEN 'qwen-code'
		ELSE 'other'
	END,
	"agent_client_id" = (
		SELECT o."client_id" FROM "oauth_client" o
		WHERE o."name" = replace(replace(replace(f."client", '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
		LIMIT 1
	),
	"body" = regexp_replace(c."body", '<p><em>— via .+? \(agent\)</em></p>\s*$', '')
FROM footer f
WHERE f."id" = c."id" AND f."client" IS NOT NULL;
