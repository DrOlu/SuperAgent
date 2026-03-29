import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { AgentPersistenceHandle, AgentRuntimeInfo, AgentTimelineItem } from "../agent/agent-sdk-types.js";
import type { StoredAgentRecord } from "../agent/agent-storage.js";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  directory: text("directory").notNull().unique(),
  displayName: text("display_name").notNull(),
  kind: text("kind").notNull(),
  gitRemote: text("git_remote"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
});

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    directory: text("directory").notNull().unique(),
    displayName: text("display_name").notNull(),
    kind: text("kind").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [index("workspaces_project_id_idx").on(table.projectId)],
);

export const agentSnapshots = sqliteTable("agent_snapshots", {
  agentId: text("agent_id").primaryKey(),
  provider: text("provider").notNull(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  cwd: text("cwd").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastActivityAt: text("last_activity_at"),
  lastUserMessageAt: text("last_user_message_at"),
  title: text("title"),
  labels: text("labels", { mode: "json" }).$type<StoredAgentRecord["labels"]>().notNull(),
  lastStatus: text("last_status").notNull(),
  lastModeId: text("last_mode_id"),
  config: text("config", { mode: "json" }).$type<StoredAgentRecord["config"]>(),
  runtimeInfo: text("runtime_info", { mode: "json" }).$type<AgentRuntimeInfo>(),
  persistence: text("persistence", { mode: "json" }).$type<AgentPersistenceHandle>(),
  requiresAttention: integer("requires_attention", { mode: "boolean" }).notNull(),
  attentionReason: text("attention_reason"),
  attentionTimestamp: text("attention_timestamp"),
  internal: integer("internal", { mode: "boolean" }).notNull(),
  archivedAt: text("archived_at"),
});

export const agentTimelineRows = sqliteTable(
  "agent_timeline_rows",
  {
    agentId: text("agent_id").notNull(),
    seq: integer("seq").notNull(),
    committedAt: text("committed_at").notNull(),
    item: text("item", { mode: "json" }).$type<AgentTimelineItem>().notNull(),
    itemKind: text("item_kind"),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.seq], name: "agent_timeline_rows_pk" }),
  ],
);

export const paseoDbSchema = {
  projects,
  workspaces,
  agentSnapshots,
  agentTimelineRows,
};
