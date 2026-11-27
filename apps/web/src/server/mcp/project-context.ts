import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import {
  board,
  boardColumn,
  label,
  milestone,
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
  milestones: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.enum(["upcoming", "active", "closed"]),
        targetDate: z.string().nullable(),
      }),
    )
    .describe("Open milestones (upcoming/active) in board order."),
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

  const [labels, columns, ownerRows, memberRows, milestones] =
    await Promise.all([
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
      db
        .select({
          id: milestone.id,
          name: milestone.name,
          status: milestone.status,
          targetAt: milestone.targetAt,
        })
        .from(milestone)
        .where(
          and(
            eq(milestone.boardId, projectRow.boardId),
            ne(milestone.status, "closed"),
          ),
        )
        .orderBy(asc(milestone.position)),
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
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      targetDate: m.targetAt ? m.targetAt.toISOString().slice(0, 10) : null,
    })),
    priorities: [...PRIORITIES],
    todayUtc: new Date().toISOString().slice(0, 10),
  };
}
