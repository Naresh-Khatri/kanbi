import "server-only";

import { and, asc, gt, inArray, like, lt, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { env } from "@/env";
import { deleteObjects, listObjects, r2Configured } from "@/lib/r2";
import type { db as Database } from "@/server/db";
import {
  comment,
  documentFile,
  documentRevision,
  projectDocument,
  task,
  taskAttachment,
} from "@/server/db/schema";
import {
  fileRefs,
  planSweep,
  STORAGE_PREFIXES,
  SWEEP_GRACE_MS,
  type StoredObject,
} from "./plan";

const PAGE = 500;

// keyset pages so revision bodies never load all at once
async function collectRefs(
  db: typeof Database,
  table: PgTable,
  idCol: PgColumn,
  bodyCol: PgColumn,
  into: Set<string>,
) {
  let after = "";
  for (;;) {
    const rows = (await db
      .select({ id: idCol, body: bodyCol })
      .from(table)
      .where(and(gt(idCol, after), like(bodyCol, "%/api/files/%") as SQL))
      .orderBy(asc(idCol))
      .limit(PAGE)) as { id: string; body: string | null }[];
    for (const row of rows) fileRefs(row.body, into);
    if (rows.length < PAGE) return;
    after = rows[rows.length - 1]!.id;
  }
}

/** Nightly: unreferenced doc images + R2 objects with no row. `STORAGE_SWEEP=dry-run` (default) only logs. */
export async function runStorageSweep(db: typeof Database) {
  const mode = env.STORAGE_SWEEP;
  if (mode === "off" || !r2Configured()) return { skipped: true as const };
  const dryRun = mode !== "on";
  const now = new Date();
  const cutoff = new Date(now.getTime() - SWEEP_GRACE_MS);

  const referencedIds = new Set<string>();
  await collectRefs(
    db,
    projectDocument,
    projectDocument.id,
    projectDocument.body,
    referencedIds,
  );
  await collectRefs(
    db,
    documentRevision,
    documentRevision.id,
    documentRevision.body,
    referencedIds,
  );
  await collectRefs(db, task, task.id, task.description, referencedIds);
  await collectRefs(db, comment, comment.id, comment.body, referencedIds);

  const docFiles = await db
    .select({
      id: documentFile.id,
      key: documentFile.key,
      createdAt: documentFile.createdAt,
    })
    .from(documentFile)
    .where(lt(documentFile.createdAt, cutoff));

  // listed before reading rows: an object registered mid-run is then already known
  const objects: StoredObject[] = [];
  for (const prefix of STORAGE_PREFIXES) {
    for await (const o of listObjects(prefix)) objects.push(o);
  }
  const knownKeys = new Set<string>();
  for (const r of await db
    .select({ key: taskAttachment.key })
    .from(taskAttachment))
    knownKeys.add(r.key);
  for (const r of await db.select({ key: documentFile.key }).from(documentFile))
    knownKeys.add(r.key);

  const { unusedDocFiles, orphanKeys } = planSweep({
    docFiles,
    referencedIds,
    knownKeys,
    objects,
    now,
  });
  const result = {
    dryRun,
    unusedDocImages: unusedDocFiles.length,
    orphanObjects: orphanKeys.length,
    failed: 0,
  };
  if (dryRun) return result;

  for (let i = 0; i < unusedDocFiles.length; i += PAGE) {
    const ids = unusedDocFiles.slice(i, i + PAGE).map((f) => f.id);
    await db.delete(documentFile).where(inArray(documentFile.id, ids));
  }
  const failed = await deleteObjects([
    ...unusedDocFiles.map((f) => f.key),
    ...orphanKeys,
  ]);
  // failed doc-image keys have no row now -> next run retries them as orphans
  return { ...result, failed: failed.length };
}
