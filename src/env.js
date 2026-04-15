import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		BETTER_AUTH_URL: z.string().url().optional(),
		BETTER_AUTH_GITHUB_CLIENT_ID: z.string(),
		BETTER_AUTH_GITHUB_CLIENT_SECRET: z.string(),
		DATABASE_URL: z.string().url(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		// Cloudflare R2 (S3-compatible) for task attachments
		R2_ACCOUNT_ID: z.string().optional(),
		R2_ACCESS_KEY_ID: z.string().optional(),
		R2_SECRET_ACCESS_KEY: z.string().optional(),
		R2_BUCKET: z.string().optional(),
		R2_PUBLIC_BASE_URL: z.string().url().optional(),
	},

	client: {},

	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		BETTER_AUTH_GITHUB_CLIENT_ID: process.env.BETTER_AUTH_GITHUB_CLIENT_ID,
		BETTER_AUTH_GITHUB_CLIENT_SECRET:
			process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		NODE_ENV: process.env.NODE_ENV,
		R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
		R2_BUCKET: process.env.R2_BUCKET,
		R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
