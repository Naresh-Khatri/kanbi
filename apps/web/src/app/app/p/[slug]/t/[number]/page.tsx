import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { TaskPageView } from "@/app/app/p/[slug]/_components/task-page-view";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { db } from "@/server/db";
import { task } from "@/server/db/schema";
import { api, HydrateClient } from "@/trpc/server";

const findTask = cache(async (boardId: string, number: number) => {
  const [row] = await db
    .select({ id: task.id, title: task.title })
    .from(task)
    .where(and(eq(task.boardId, boardId), eq(task.number, number)))
    .limit(1);
  return row ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; number: string }>;
}): Promise<Metadata> {
  const { slug, number } = await params;
  const project = await resolveProject(slug);
  const n = Number(number);
  if (!project || !Number.isInteger(n)) return { title: "Kanbi" };
  const row = await findTask(project.boardId, n);
  const id = `${project.key}-${n}`;
  return { title: row ? `${id} · ${row.title} · Kanbi` : `${id} · Kanbi` };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ slug: string; number: string }>;
}) {
  const { slug, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  // membership checked here; the id lookup below relies on it
  const project = await resolveProject(slug);
  if (!project) notFound();
  const { boardId } = project;

  const row = await findTask(boardId, n);
  // panels hydrate filled -> no per-section skeletons on a full page load
  const input = row ? { boardId, taskId: row.id } : null;
  await Promise.all([
    api.board.get.prefetch({ boardId }),
    ...(input
      ? [
          api.checklist.list.prefetch(input),
          api.attachment.list.prefetch(input),
          api.comment.list.prefetch(input),
          api.activity.list.prefetch({ ...input, limit: 50 }),
          api.document.linkedToTask.prefetch(input),
          api.today.ids.prefetch(),
        ]
      : []),
  ]);

  // own boundary: layout's HydrateClient dehydrates before these prefetches land
  return (
    <HydrateClient>
      <TaskPageView
        boardId={boardId}
        number={n}
        projectId={project.id}
        projectKey={project.key}
        projectSlug={project.slug}
      />
    </HydrateClient>
  );
}
