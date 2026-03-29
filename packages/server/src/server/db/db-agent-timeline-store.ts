import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";

import type {
  AgentTimelineFetchOptions,
  AgentTimelineFetchResult,
  AgentTimelineRow,
  AgentTimelineStore,
  AgentTimelineWindow,
} from "../agent/agent-timeline-store-types.js";
import type { AgentTimelineItem } from "../agent/agent-sdk-types.js";
import type { PaseoDatabaseHandle } from "./sqlite-database.js";
import { agentTimelineRows } from "./schema.js";

type AgentTimelineRowRecord = typeof agentTimelineRows.$inferSelect;
type AgentTimelineRowInsert = typeof agentTimelineRows.$inferInsert;

const DEFAULT_TIMELINE_FETCH_LIMIT = 200;

function normalizeTimelineMessageId(messageId: string | undefined): string | undefined {
  if (typeof messageId !== "string") {
    return undefined;
  }
  const normalized = messageId.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toTimelineRow(row: AgentTimelineRowRecord): AgentTimelineRow {
  return {
    seq: row.seq,
    timestamp: row.committedAt,
    item: row.item,
  };
}

function toInsertValues(agentId: string, row: AgentTimelineRow): AgentTimelineRowInsert {
  return {
    agentId,
    seq: row.seq,
    committedAt: row.timestamp,
    item: row.item,
    itemKind: row.item.type,
  };
}

function normalizeFetchLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_TIMELINE_FETCH_LIMIT;
  }
  return Math.max(0, Math.floor(limit));
}

export class DbAgentTimelineStore implements AgentTimelineStore {
  private readonly db: PaseoDatabaseHandle["db"];

  constructor(db: PaseoDatabaseHandle["db"]) {
    this.db = db;
  }

  async appendCommitted(
    agentId: string,
    item: AgentTimelineItem,
    options?: { timestamp?: string },
  ): Promise<AgentTimelineRow> {
    const nextSeq = (await this.getMaxSeq(agentId)) + 1;
    const row: AgentTimelineRow = {
      seq: nextSeq,
      timestamp: options?.timestamp ?? new Date().toISOString(),
      item,
    };

    await this.db.insert(agentTimelineRows).values(toInsertValues(agentId, row));
    return row;
  }

  async fetchCommitted(
    agentId: string,
    options?: AgentTimelineFetchOptions,
  ): Promise<AgentTimelineFetchResult> {
    const direction = options?.direction ?? "tail";
    const limit = normalizeFetchLimit(options?.limit);
    const selectAll = limit === 0;
    const window = await this.getWindow(agentId);

    if (window.maxSeq === 0) {
      return {
        direction,
        window,
        hasOlder: false,
        hasNewer: false,
        rows: [],
      };
    }

    if (direction === "tail") {
      const rows = selectAll
        ? await this.db
            .select()
            .from(agentTimelineRows)
            .where(eq(agentTimelineRows.agentId, agentId))
            .orderBy(asc(agentTimelineRows.seq))
        : (
            await this.db
              .select()
              .from(agentTimelineRows)
              .where(eq(agentTimelineRows.agentId, agentId))
              .orderBy(desc(agentTimelineRows.seq))
              .limit(limit)
          ).reverse();
      const selected = rows.map(toTimelineRow);
      return {
        direction,
        window,
        hasOlder: selected.length > 0 && selected[0]!.seq > window.minSeq,
        hasNewer: false,
        rows: selected,
      };
    }

    if (direction === "after") {
      const baseSeq = options?.cursor?.seq ?? 0;
      const rows = (
        selectAll
          ? await this.db
              .select()
              .from(agentTimelineRows)
              .where(and(eq(agentTimelineRows.agentId, agentId), gt(agentTimelineRows.seq, baseSeq)))
              .orderBy(asc(agentTimelineRows.seq))
          : await this.db
              .select()
              .from(agentTimelineRows)
              .where(and(eq(agentTimelineRows.agentId, agentId), gt(agentTimelineRows.seq, baseSeq)))
              .orderBy(asc(agentTimelineRows.seq))
              .limit(limit)
      ).map(toTimelineRow);

      if (rows.length === 0) {
        return {
          direction,
          window,
          hasOlder: baseSeq >= window.minSeq,
          hasNewer: false,
          rows,
        };
      }

      const lastSelected = rows[rows.length - 1]!;
      return {
        direction,
        window,
        hasOlder: rows[0]!.seq > window.minSeq,
        hasNewer: lastSelected.seq < window.maxSeq,
        rows,
      };
    }

    const beforeSeq = options?.cursor?.seq ?? window.nextSeq;
    const rows = (
      selectAll
        ? await this.db
            .select()
            .from(agentTimelineRows)
            .where(and(eq(agentTimelineRows.agentId, agentId), lt(agentTimelineRows.seq, beforeSeq)))
            .orderBy(asc(agentTimelineRows.seq))
        : (
            await this.db
              .select()
              .from(agentTimelineRows)
              .where(and(eq(agentTimelineRows.agentId, agentId), lt(agentTimelineRows.seq, beforeSeq)))
              .orderBy(desc(agentTimelineRows.seq))
              .limit(limit)
          ).reverse()
    ).map(toTimelineRow);

    return {
      direction,
      window,
      hasOlder: rows.length > 0 && rows[0]!.seq > window.minSeq,
      hasNewer: beforeSeq <= window.maxSeq,
      rows,
    };
  }

  async getLatestCommittedSeq(agentId: string): Promise<number> {
    return this.getMaxSeq(agentId);
  }

  async getCommittedRows(agentId: string): Promise<AgentTimelineRow[]> {
    const rows = await this.db
      .select()
      .from(agentTimelineRows)
      .where(eq(agentTimelineRows.agentId, agentId))
      .orderBy(asc(agentTimelineRows.seq));
    return rows.map(toTimelineRow);
  }

  async getLastItem(agentId: string): Promise<AgentTimelineItem | null> {
    const [row] = await this.db
      .select({ item: agentTimelineRows.item })
      .from(agentTimelineRows)
      .where(eq(agentTimelineRows.agentId, agentId))
      .orderBy(desc(agentTimelineRows.seq))
      .limit(1);
    return row?.item ?? null;
  }

  async getLastAssistantMessage(agentId: string): Promise<string | null> {
    const rows = await this.db
      .select({
        seq: agentTimelineRows.seq,
        item: agentTimelineRows.item,
      })
      .from(agentTimelineRows)
      .where(
        and(
          eq(agentTimelineRows.agentId, agentId),
          eq(agentTimelineRows.itemKind, "assistant_message"),
        ),
      )
      .orderBy(desc(agentTimelineRows.seq));

    if (rows.length === 0) {
      return null;
    }

    const chunks: string[] = [];
    let previousSeq: number | null = null;
    for (const row of rows) {
      if (previousSeq !== null && row.seq !== previousSeq - 1) {
        break;
      }
      if (row.item.type !== "assistant_message") {
        break;
      }
      chunks.push(row.item.text);
      previousSeq = row.seq;
    }

    return chunks.length > 0 ? chunks.reverse().join("") : null;
  }

  async hasCommittedUserMessage(
    agentId: string,
    options: { messageId: string; text: string },
  ): Promise<boolean> {
    const messageId = normalizeTimelineMessageId(options.messageId);
    if (!messageId) {
      return false;
    }

    const [row] = await this.db
      .select({ seq: agentTimelineRows.seq })
      .from(agentTimelineRows)
      .where(
        and(
          eq(agentTimelineRows.agentId, agentId),
          eq(agentTimelineRows.itemKind, "user_message"),
          sql`json_extract(${agentTimelineRows.item}, '$.messageId') = ${messageId}`,
          sql`json_extract(${agentTimelineRows.item}, '$.text') = ${options.text}`,
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.db.delete(agentTimelineRows).where(eq(agentTimelineRows.agentId, agentId));
  }

  async bulkInsert(agentId: string, rows: readonly AgentTimelineRow[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.db.insert(agentTimelineRows).values(rows.map((row) => toInsertValues(agentId, row)));
  }

  private async getMaxSeq(agentId: string): Promise<number> {
    const [row] = await this.db
      .select({
        maxSeq: sql<number>`coalesce(max(${agentTimelineRows.seq}), 0)`,
      })
      .from(agentTimelineRows)
      .where(eq(agentTimelineRows.agentId, agentId));
    return Number(row?.maxSeq ?? 0);
  }

  private async getWindow(agentId: string): Promise<AgentTimelineWindow> {
    const [row] = await this.db
      .select({
        minSeq: sql<number>`coalesce(min(${agentTimelineRows.seq}), 0)`,
        maxSeq: sql<number>`coalesce(max(${agentTimelineRows.seq}), 0)`,
      })
      .from(agentTimelineRows)
      .where(eq(agentTimelineRows.agentId, agentId));
    const minSeq = Number(row?.minSeq ?? 0);
    const maxSeq = Number(row?.maxSeq ?? 0);
    return {
      minSeq,
      maxSeq,
      nextSeq: maxSeq + 1,
    };
  }
}
