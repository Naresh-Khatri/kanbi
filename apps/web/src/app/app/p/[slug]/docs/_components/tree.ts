import type { RouterOutputs } from "@/trpc/react";

export type DocumentList = RouterOutputs["document"]["list"];
export type DocumentNode = {
  document: DocumentList[number];
  children: DocumentNode[];
};

// visited guards against parent cycles; orphans surface at the root
export function buildTree(documents: DocumentList): DocumentNode[] {
  const byParent = new Map<string | null, DocumentList>();
  for (const document of documents) {
    const rows = byParent.get(document.parentId) ?? [];
    rows.push(document);
    byParent.set(document.parentId, rows);
  }
  for (const rows of byParent.values())
    rows.sort((a, b) => a.position - b.position);

  const visited = new Set<string>();
  const walk = (parentId: string | null): DocumentNode[] => {
    const nodes: DocumentNode[] = [];
    for (const document of byParent.get(parentId) ?? []) {
      if (visited.has(document.id)) continue;
      visited.add(document.id);
      nodes.push({ document, children: walk(document.id) });
    }
    return nodes;
  };
  const roots = walk(null);
  for (const document of documents) {
    if (visited.has(document.id)) continue;
    visited.add(document.id);
    roots.push({ document, children: walk(document.id) });
  }
  return roots;
}

export function documentBreadcrumbs(
  documents: DocumentList,
  documentId: string,
) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const result: DocumentList = [];
  const visited = new Set<string>();
  let cursor = byId.get(documentId);
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    result.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return result;
}

export function descendantIds(documents: DocumentList, documentId: string) {
  const ids = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const document of documents) {
      if (
        (document.parentId === documentId ||
          (document.parentId && ids.has(document.parentId))) &&
        !ids.has(document.id)
      ) {
        ids.add(document.id);
        changed = true;
      }
    }
  }
  return ids;
}
