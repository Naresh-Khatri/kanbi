import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import {
  board,
  boardColumn,
  label,
  project,
  projectMember,
  taskPriority,
  user as userTable,
} from "@/server/db/schema";

export const PRIORITIES = taskPriority.enumValues;
export const priorityEnum = z.enum(PRIORITIES);

export const projectContextOutput = {
  project: z.object({
    id: z.string(),
    key: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    authoringGuidance: z.string().nullable(),
  }),
  boardId: z.string(),
  columns: z.array(
    z.object({ id: z.string(), name: z.string(), category: z.string() }),
  ),
  labels: z.array(
    z.object({ id: z.string(), name: z.string(), color: z.string() }),
  ),
  members: z.array(z.object({ id: z.string(), name: z.string() })),
  priorities: z.array(priorityEnum),
  todayUtc: z.string(),
};

/** Canonical ids for capture. Caller must have checked project access. */
export async function loadProjectContext(projectId: string) {
  const [projectRow] = await db
    .select({
      id: project.id,
      key: project.key,
      slug: project.slug,
      name: project.name,
      description: project.description,
      authoringGuidance: project.systemPrompt,
      boardId: board.id,
    })
    .from(project)
    .innerJoin(board, eq(board.projectId, project.id))
    .where(eq(project.id, projectId))
    .limit(1);
  if (!projectRow) throw new Error("Project board not found.");

  const [labels, columns, ownerRows, memberRows] = await Promise.all([
    db
      .select({ id: label.id, name: label.name, color: label.color })
      .from(label)
      .where(eq(label.boardId, projectRow.boardId)),
    db
      .select({
        id: boardColumn.id,
        name: boardColumn.name,
        category: boardColumn.category,
      })
      .from(boardColumn)
      .where(eq(boardColumn.boardId, projectRow.boardId))
      .orderBy(asc(boardColumn.position)),
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(project)
      .innerJoin(userTable, eq(userTable.id, project.ownerId))
      .where(eq(project.id, projectId)),
    db
      .select({ id: userTable.id, name: userTable.name })
      .from(projectMember)
      .innerJoin(userTable, eq(userTable.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId)),
  ]);
  const members = Array.from(
    new Map(
      [...ownerRows, ...memberRows].map((member) => [member.id, member]),
    ).values(),
  );

  return {
    project: {
      id: projectRow.id,
      key: projectRow.key,
      slug: projectRow.slug,
      name: projectRow.name,
      description: projectRow.description,
      authoringGuidance: projectRow.authoringGuidance,
    },
    boardId: projectRow.boardId,
    columns,
    labels,
    members,
    priorities: [...PRIORITIES],
    todayUtc: new Date().toISOString().slice(0, 10),
  };
}
