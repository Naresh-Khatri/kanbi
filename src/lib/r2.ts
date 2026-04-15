import "server-only";

import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";
import { nanoid } from "@/lib/ids";

let cached: S3Client | null = null;

export function getR2() {
	if (cached) return cached;
	if (
		!env.R2_ACCOUNT_ID ||
		!env.R2_ACCESS_KEY_ID ||
		!env.R2_SECRET_ACCESS_KEY ||
		!env.R2_BUCKET
	) {
		throw new Error("R2 is not configured (set R2_* env vars)");
	}
	cached = new S3Client({
		region: "auto",
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		},
	});
	return cached;
}

export function buildAttachmentKey(opts: { taskId: string; filename: string }) {
	const safeName = opts.filename.replace(/[^\w.-]+/g, "_").slice(0, 80);
	return `attachments/${opts.taskId}/${nanoid()}-${safeName}`;
}

export async function presignUpload(opts: {
	key: string;
	contentType: string;
	expiresIn?: number;
}) {
	const client = getR2();
	return getSignedUrl(
		client,
		new PutObjectCommand({
			Bucket: env.R2_BUCKET!,
			Key: opts.key,
			ContentType: opts.contentType,
		}),
		{ expiresIn: opts.expiresIn ?? 60 * 5 },
	);
}

export async function presignDownload(opts: {
	key: string;
	expiresIn?: number;
}) {
	if (env.R2_PUBLIC_BASE_URL) {
		return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${opts.key}`;
	}
	const client = getR2();
	return getSignedUrl(
		client,
		new GetObjectCommand({ Bucket: env.R2_BUCKET!, Key: opts.key }),
		{ expiresIn: opts.expiresIn ?? 60 * 10 },
	);
}
