import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgTableCreator,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const createTable = pgTableCreator((name) => `kanbi_${name}`);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date());

// ── Better Auth tables (unprefixed — owned by the adapter) ──────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

// ── Enums ───────────────────────────────────────────────────────────────────

export const projectRole = pgEnum("kanbi_project_role", [
  "owner",
  "editor",
  "viewer",
]);

export const taskPriority = pgEnum("kanbi_task_priority", [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

// ── Projects ────────────────────────────────────────────────────────────────

export const project = createTable(
  "project",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("project_owner_slug_uq").on(t.ownerId, t.slug),
    index("project_owner_idx").on(t.ownerId),
  ],
);

export const projectMember = createTable(
  "project_member",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: projectRole("role").notNull().default("viewer"),
    invitedAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_member_user_idx").on(t.userId),
  ],
);

export const projectInvite = createTable(
  "project_invite",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: projectRole("role").notNull().default("editor"),
    token: text("token").notNull().unique(),
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("project_invite_project_idx").on(t.projectId),
    index("project_invite_email_idx").on(t.email),
  ],
);

// ── Boards / Columns / Tasks ────────────────────────────────────────────────

export const board = createTable("board", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => project.id, { onDelete: "cascade" }),
  settings: jsonb("settings")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const boardColumn = createTable(
  "column",
  {
    id: id(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: real("position").notNull(),
    wipLimit: integer("wip_limit"),
    color: text("color"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("column_board_position_idx").on(t.boardId, t.position)],
);

export const task = createTable(
  "task",
  {
    id: id(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    columnId: text("column_id")
      .notNull()
      .references(() => boardColumn.id, { onDelete: "cascade" }),
    position: real("position").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriority("priority").notNull().default("none"),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("task_column_position_idx").on(t.columnId, t.position),
    index("task_board_idx").on(t.boardId),
    index("task_assignee_idx").on(t.assigneeId),
  ],
);

// ── Labels ──────────────────────────────────────────────────────────────────

export const label = createTable(
  "label",
  {
    id: id(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("label_board_idx").on(t.boardId)],
);

export const taskLabel = createTable(
  "task_label",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => label.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
);

// ── Checklist / Attachments / Comments / Activity ───────────────────────────

export const checklistItem = createTable(
  "checklist_item",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
    position: real("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("checklist_task_position_idx").on(t.taskId, t.position)],
);

export const taskAttachment = createTable(
  "task_attachment",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("attachment_task_idx").on(t.taskId)],
);

export const comment = createTable(
  "comment",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("comment_task_idx").on(t.taskId, t.createdAt)],
);

export const activity = createTable(
  "activity",
  {
    id: id(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => task.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    verb: text("verb").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index("activity_board_created_idx").on(t.boardId, t.createdAt)],
);

// ── Public read-only share link ─────────────────────────────────────────────

export const boardShare = createTable(
  "board_share",
  {
    id: id(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("board_share_board_idx").on(t.boardId)],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  ownedProjects: many(project),
  memberships: many(projectMember),
  assignedTasks: many(task),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  owner: one(user, { fields: [project.ownerId], references: [user.id] }),
  board: one(board, { fields: [project.id], references: [board.projectId] }),
  members: many(projectMember),
  invites: many(projectInvite),
}));

export const projectMemberRelations = relations(projectMember, ({ one }) => ({
  project: one(project, {
    fields: [projectMember.projectId],
    references: [project.id],
  }),
  user: one(user, { fields: [projectMember.userId], references: [user.id] }),
}));

export const projectInviteRelations = relations(projectInvite, ({ one }) => ({
  project: one(project, {
    fields: [projectInvite.projectId],
    references: [project.id],
  }),
  invitedBy: one(user, {
    fields: [projectInvite.invitedById],
    references: [user.id],
  }),
}));

export const boardRelations = relations(board, ({ one, many }) => ({
  project: one(project, {
    fields: [board.projectId],
    references: [project.id],
  }),
  columns: many(boardColumn),
  tasks: many(task),
  labels: many(label),
  shares: many(boardShare),
}));

export const boardColumnRelations = relations(boardColumn, ({ one, many }) => ({
  board: one(board, { fields: [boardColumn.boardId], references: [board.id] }),
  tasks: many(task),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  board: one(board, { fields: [task.boardId], references: [board.id] }),
  column: one(boardColumn, {
    fields: [task.columnId],
    references: [boardColumn.id],
  }),
  reporter: one(user, { fields: [task.reporterId], references: [user.id] }),
  assignee: one(user, { fields: [task.assigneeId], references: [user.id] }),
  labels: many(taskLabel),
  checklist: many(checklistItem),
  attachments: many(taskAttachment),
  comments: many(comment),
}));

export const labelRelations = relations(label, ({ one, many }) => ({
  board: one(board, { fields: [label.boardId], references: [board.id] }),
  tasks: many(taskLabel),
}));

export const taskLabelRelations = relations(taskLabel, ({ one }) => ({
  task: one(task, { fields: [taskLabel.taskId], references: [task.id] }),
  label: one(label, { fields: [taskLabel.labelId], references: [label.id] }),
}));

export const checklistItemRelations = relations(checklistItem, ({ one }) => ({
  task: one(task, { fields: [checklistItem.taskId], references: [task.id] }),
}));

export const taskAttachmentRelations = relations(taskAttachment, ({ one }) => ({
  task: one(task, { fields: [taskAttachment.taskId], references: [task.id] }),
  uploader: one(user, {
    fields: [taskAttachment.uploaderId],
    references: [user.id],
  }),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  task: one(task, { fields: [comment.taskId], references: [task.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
}));

export const activityRelations = relations(activity, ({ one }) => ({
  board: one(board, { fields: [activity.boardId], references: [board.id] }),
  task: one(task, { fields: [activity.taskId], references: [task.id] }),
  actor: one(user, { fields: [activity.actorId], references: [user.id] }),
}));

export const boardShareRelations = relations(boardShare, ({ one }) => ({
  board: one(board, { fields: [boardShare.boardId], references: [board.id] }),
  createdBy: one(user, {
    fields: [boardShare.createdById],
    references: [user.id],
  }),
}));
