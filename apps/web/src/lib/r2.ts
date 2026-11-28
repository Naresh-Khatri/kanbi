import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";
import { nanoid } from "@/lib/ids";

let cached: S3Client | null = null;

export const r2Configured = () =>
  !!(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET
  );

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

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function buildAttachmentKey(opts: { taskId: string; filename: string }) {
  const safeName = opts.filename.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return `attachments/${opts.taskId}/${nanoid()}-${safeName}`;
}

export function buildDocumentFileKey(opts: {
  projectId: string;
  filename: string;
}) {
  const safeName = opts.filename.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return `docs/${opts.projectId}/${nanoid()}-${safeName}`;
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

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await getR2().send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }),
  );
  if (!res.Body) throw new Error(`R2 object ${key} has no body`);
  return res.Body.transformToByteArray();
}

/** Null when the object was never uploaded. */
export async function headObject(
  key: string,
): Promise<{ sizeBytes: number; contentType: string | null } | null> {
  try {
    const res = await getR2().send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }),
    );
    return {
      sizeBytes: res.ContentLength ?? 0,
      contentType: res.ContentType ?? null,
    };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}

export async function deleteObject(key: string) {
  await getR2().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }),
  );
}

/** Best effort: returns the keys that failed. Single deletes, not DeleteObjects (r2 checksum quirks). */
export async function deleteObjects(keys: string[], concurrency = 8) {
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i += concurrency) {
    await Promise.all(
      keys
        .slice(i, i + concurrency)
        .map((key) => deleteObject(key).catch(() => failed.push(key))),
    );
  }
  return failed;
}

export async function* listObjects(prefix: string) {
  let token: string | undefined;
  do {
    const res = await getR2().send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET!,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const o of res.Contents ?? []) {
      if (o.Key)
        yield { key: o.Key, lastModified: o.LastModified ?? new Date(0) };
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}
