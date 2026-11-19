import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { needsRebalance } from "@/lib/position";
import { resolveProjectAccess } from "@/server/api/permissions";
import { db } from "@/server/db";
import { board, boardColumn, columnCategory } from "@/server/db/schema";

import { McpUserError } from "./result";

export const COLUMN_CATEGORIES = columnCategory.enumValues;
export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

export type BoardColumn = {
  id: string;
  name: string;
  category: ColumnCategory;
  position: number;
};

export const columnRefInput = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe('Column name like "In Review" (any case), or its id.');

export const columnPositionInput = z
  .object({
    before: columnRefInput.optional(),
    after: columnRefInput.optional(),
  })
  .describe(
    "Place it before or after one column (name or id). Pass exactly one of before/after.",
  );

export type ColumnPosition = z.infer<typeof columnPositionInput>;

/** Board columns in board order. */
export async function boardColumns(boardId: string): Promise<BoardColumn[]> {
  return db
    .select({
      id: boardColumn.id,
      name: boardColumn.name,
      category: boardColumn.category,
      position: boardColumn.position,
    })
    .from(boardColumn)
    .where(eq(boardColumn.boardId, boardId))
    .orderBy(asc(boardColumn.position));
}

/** Board id of a project the user owns; column admin is owner-only over MCP. */
export async function ownedProjectBoard(userId: string, projectId: string) {
  const access = await resolveProjectAccess({ db, userId, projectId });
  if (!access.canAdmin) {
    throw new McpUserError(
      "Only the project owner can add or change columns. Ask the owner to do it in Kanbi.",
    );
  }
  if (!access.canWrite) {
    throw new McpUserError(
      "This project is archived. Unarchive it in Kanbi before changing columns.",
    );
  }
  const [row] = await db
    .select({ id: board.id })
    .from(board)
    .where(eq(board.projectId, projectId))
    .limit(1);
  if (!row) throw new Error("Project board not found.");
  return row.id;
}

export const publicColumn = (c: BoardColumn) => ({
  id: c.id,
  name: c.name,
  category: c.category,
});

function columnList(columns: readonly BoardColumn[]): string {
  return columns
    .map((c) => `"${c.name}" (${c.category}, id ${c.id})`)
    .join(", ");
}

/** Exact id, else case-insensitive name. Never guesses between several. */
export function findColumn(
  columns: readonly BoardColumn[],
  ref: string,
): BoardColumn {
  const wanted = ref.trim();
  const byId = columns.find((c) => c.id === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase();
  const matches = columns.filter((c) => c.name.trim().toLowerCase() === lower);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new McpUserError(
      `"${wanted}" matches more than one column: ${columnList(matches)}. Pass the column id.`,
    );
  }
  throw new McpUserError(
    `No column "${wanted}" on this board. Columns: ${columnList(columns)}.`,
  );
}

export function assertFreeName(
  columns: readonly BoardColumn[],
  name: string,
  exceptId?: string,
) {
  const lower = name.trim().toLowerCase();
  const clash = columns.find(
    (c) => c.id !== exceptId && c.name.trim().toLowerCase() === lower,
  );
  if (clash) {
    // duplicate names would make every later name lookup ambiguous
    throw new McpUserError(
      `This board already has a column named "${clash.name}". Pick another name.`,
    );
  }
}

/** finish_task and the work queue need a done column to land in. */
export function assertKeepsDoneColumn(
  columns: readonly BoardColumn[],
  column: BoardColumn,
  nextCategory: ColumnCategory,
) {
  if (column.category !== "completed" || nextCategory === "completed") return;
  if (columns.some((c) => c.id !== column.id && c.category === "completed")) {
    return;
  }
  throw new McpUserError(
    `"${column.name}" is the board's only done column, and finished tasks need one. Add another column with category completed first, or keep this one as completed.`,
  );
}

const RANK: Record<ColumnCategory, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  review: 3,
  completed: 4,
  canceled: 5,
};

/**
 * Neighbour positions for placing a column (for positionBetween). Default:
 * end of its category group, else after the last earlier category.
 */
export function columnSlot(
  columns: readonly BoardColumn[],
  opts: {
    category: ColumnCategory;
    position?: ColumnPosition;
    movingId?: string;
  },
): { before: number | null; after: number | null } {
  const { position, movingId } = opts;
  const others = columns.filter((c) => c.id !== movingId);

  let index: number; // slot goes right after others[index]; -1 = first
  if (position && (position.before ?? position.after)) {
    if (position.before && position.after) {
      throw new McpUserError(
        "Pass only one of position.before or position.after.",
      );
    }
    const ref = (position.before ?? position.after)!;
    const anchor = findColumn(columns, ref);
    if (anchor.id === movingId) {
      throw new McpUserError(
        "Place the column next to a different column, not itself.",
      );
    }
    const at = others.findIndex((c) => c.id === anchor.id);
    index = position.before ? at - 1 : at;
  } else {
    const rank = RANK[opts.category];
    const lastWhere = (pred: (c: BoardColumn) => boolean) => {
      for (let i = others.length - 1; i >= 0; i--)
        if (pred(others[i]!)) return i;
      return -1;
    };
    const same = lastWhere((c) => c.category === opts.category);
    index = same >= 0 ? same : lastWhere((c) => RANK[c.category] < rank);
  }

  const before = index >= 0 ? others[index]!.position : null;
  const after = others[index + 1]?.position ?? null;
  if (before !== null && after !== null && needsRebalance(before, after)) {
    throw new McpUserError(
      "There is no room left between those columns. Place it somewhere else.",
    );
  }
  return { before, after };
}
