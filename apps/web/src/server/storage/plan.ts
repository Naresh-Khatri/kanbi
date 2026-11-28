export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

export const STORAGE_PREFIXES = ["attachments/", "docs/"] as const;

// broader than extractFileIds (any /api/files/<id>, not just img/video src): over-keeping is safe
const FILE_REF_RE = /\/api\/files\/([A-Za-z0-9_-]+)/g;

export function fileRefs(
  html: string | null | undefined,
  into = new Set<string>(),
) {
  if (!html) return into;
  for (const m of html.matchAll(FILE_REF_RE)) into.add(m[1]!);
  return into;
}

export type DocFileRow = { id: string; key: string; createdAt: Date };
export type StoredObject = { key: string; lastModified: Date };

/**
 * Doc images die once no page, revision, task or comment mentions them.
 * Task attachments are never swept by reference (released ones stay in the gallery),
 * only objects with no row at all.
 */
export function planSweep(opts: {
  docFiles: DocFileRow[];
  referencedIds: Set<string>;
  knownKeys: Set<string>;
  objects: StoredObject[];
  now: Date;
  graceMs?: number;
}) {
  const cutoff = opts.now.getTime() - (opts.graceMs ?? SWEEP_GRACE_MS);
  const unusedDocFiles = opts.docFiles.filter(
    (f) => f.createdAt.getTime() < cutoff && !opts.referencedIds.has(f.id),
  );
  const orphanKeys = opts.objects
    .filter(
      (o) =>
        o.lastModified.getTime() < cutoff &&
        !opts.knownKeys.has(o.key) &&
        STORAGE_PREFIXES.some((p) => o.key.startsWith(p)),
    )
    .map((o) => o.key);
  return { unusedDocFiles, orphanKeys };
}
