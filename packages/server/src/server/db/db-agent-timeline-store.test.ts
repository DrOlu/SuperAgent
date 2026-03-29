import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { AgentTimelineItem } from "../agent/agent-sdk-types.js";
import type { AgentTimelineRow } from "../agent/agent-timeline-store-types.js";
import { openPaseoDatabase, type PaseoDatabaseHandle } from "./sqlite-database.js";
import { DbAgentTimelineStore } from "./db-agent-timeline-store.js";
import { agentTimelineRows } from "./schema.js";

function createTimestamp(seq: number): string {
  return new Date(Date.UTC(2026, 2, 1, 0, 0, seq)).toISOString();
}

function createTimelineItem(
  type: Extract<AgentTimelineItem["type"], "assistant_message" | "user_message">,
  value: string,
): AgentTimelineItem {
  if (type === "user_message") {
    return {
      type,
      text: `user-${value}`,
      messageId: `message-${value}`,
    };
  }

  return {
    type,
    text: `assistant-${value}`,
  };
}

function createRow(seq: number, item?: AgentTimelineItem): AgentTimelineRow {
  return {
    seq,
    timestamp: createTimestamp(seq),
    item: item ?? createTimelineItem("assistant_message", String(seq)),
  };
}

describe("DbAgentTimelineStore", () => {
  let tmpDir: string;
  let dataDir: string;
  let database: PaseoDatabaseHandle;
  let store: DbAgentTimelineStore;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "db-agent-timeline-store-"));
    dataDir = path.join(tmpDir, "db");
    database = await openPaseoDatabase(dataDir);
    store = new DbAgentTimelineStore(database.db);
  });

  afterEach(async () => {
    await database.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("appendCommitted assigns sequential seq numbers per agent", async () => {
    expect(
      await store.appendCommitted("agent-1", createTimelineItem("assistant_message", "1")),
    ).toEqual({
      seq: 1,
      timestamp: expect.any(String),
      item: createTimelineItem("assistant_message", "1"),
    });

    expect(
      await store.appendCommitted("agent-1", createTimelineItem("assistant_message", "2")),
    ).toEqual({
      seq: 2,
      timestamp: expect.any(String),
      item: createTimelineItem("assistant_message", "2"),
    });

    expect(
      await store.appendCommitted("agent-1", createTimelineItem("assistant_message", "3")),
    ).toEqual({
      seq: 3,
      timestamp: expect.any(String),
      item: createTimelineItem("assistant_message", "3"),
    });
  });

  test("appendCommitted for different agents has independent seq sequences", async () => {
    const firstAgentFirstRow = await store.appendCommitted(
      "agent-1",
      createTimelineItem("assistant_message", "a1"),
    );
    const secondAgentFirstRow = await store.appendCommitted(
      "agent-2",
      createTimelineItem("assistant_message", "b1"),
    );
    const firstAgentSecondRow = await store.appendCommitted(
      "agent-1",
      createTimelineItem("assistant_message", "a2"),
    );

    expect(firstAgentFirstRow.seq).toBe(1);
    expect(secondAgentFirstRow.seq).toBe(1);
    expect(firstAgentSecondRow.seq).toBe(2);
  });

  test("fetchCommitted tail returns the last N rows", async () => {
    await store.bulkInsert("agent-1", [1, 2, 3, 4, 5].map((seq) => createRow(seq)));

    await expect(
      store.fetchCommitted("agent-1", {
        direction: "tail",
        limit: 2,
      }),
    ).resolves.toEqual({
      direction: "tail",
      window: {
        minSeq: 1,
        maxSeq: 5,
        nextSeq: 6,
      },
      hasOlder: true,
      hasNewer: false,
      rows: [createRow(4), createRow(5)],
    });
  });

  test("fetchCommitted after-cursor returns rows after a given seq", async () => {
    await store.bulkInsert("agent-1", [1, 2, 3, 4, 5].map((seq) => createRow(seq)));

    await expect(
      store.fetchCommitted("agent-1", {
        direction: "after",
        cursor: { seq: 2 },
        limit: 2,
      }),
    ).resolves.toEqual({
      direction: "after",
      window: {
        minSeq: 1,
        maxSeq: 5,
        nextSeq: 6,
      },
      hasOlder: true,
      hasNewer: true,
      rows: [createRow(3), createRow(4)],
    });
  });

  test("fetchCommitted before-cursor returns rows before a given seq", async () => {
    await store.bulkInsert("agent-1", [1, 2, 3, 4, 5].map((seq) => createRow(seq)));

    await expect(
      store.fetchCommitted("agent-1", {
        direction: "before",
        cursor: { seq: 4 },
        limit: 2,
      }),
    ).resolves.toEqual({
      direction: "before",
      window: {
        minSeq: 1,
        maxSeq: 5,
        nextSeq: 6,
      },
      hasOlder: true,
      hasNewer: true,
      rows: [createRow(2), createRow(3)],
    });
  });

  test("getLatestCommittedSeq returns 0 for an unknown agent", async () => {
    await expect(store.getLatestCommittedSeq("missing-agent")).resolves.toBe(0);
  });

  test("getLatestCommittedSeq returns the latest seq after appends", async () => {
    await store.appendCommitted("agent-1", createTimelineItem("assistant_message", "1"));
    await store.appendCommitted("agent-1", createTimelineItem("assistant_message", "2"));

    await expect(store.getLatestCommittedSeq("agent-1")).resolves.toBe(2);
  });

  test("deleteAgent removes all rows for the target agent", async () => {
    await store.bulkInsert("agent-1", [createRow(1), createRow(2)]);
    await store.bulkInsert("agent-2", [createRow(1)]);

    await store.deleteAgent("agent-1");

    await expect(store.getCommittedRows("agent-1")).resolves.toEqual([]);
    await expect(store.getCommittedRows("agent-2")).resolves.toEqual([createRow(1)]);
  });

  test("bulkInsert preserves provided seq numbers", async () => {
    const rows = [createRow(3), createRow(7)];

    await store.bulkInsert("agent-1", rows);

    await expect(store.getCommittedRows("agent-1")).resolves.toEqual(rows);
  });

  test("item_kind is populated from item.type", async () => {
    await store.appendCommitted("agent-1", createTimelineItem("user_message", "kind-check"), {
      timestamp: createTimestamp(1),
    });

    await expect(database.db.select().from(agentTimelineRows)).resolves.toEqual([
      expect.objectContaining({
        agentId: "agent-1",
        seq: 1,
        committedAt: createTimestamp(1),
        itemKind: "user_message",
      }),
    ]);
  });

  test("getLastItem returns the latest committed item", async () => {
    await store.bulkInsert("agent-1", [
      createRow(1, createTimelineItem("user_message", "1")),
      createRow(2, createTimelineItem("assistant_message", "2")),
    ]);

    await expect(store.getLastItem("agent-1")).resolves.toEqual(
      createTimelineItem("assistant_message", "2"),
    );
    await expect(store.getLastItem("missing-agent")).resolves.toBeNull();
  });

  test("getLastAssistantMessage assembles the latest contiguous assistant chunks", async () => {
    await store.bulkInsert("agent-1", [
      createRow(1, createTimelineItem("assistant_message", "1")),
      createRow(2, createTimelineItem("assistant_message", "2")),
      createRow(3, { type: "reasoning", text: "separator-1" }),
      createRow(4, createTimelineItem("assistant_message", "4")),
      createRow(5, createTimelineItem("assistant_message", "5")),
      createRow(6, { type: "reasoning", text: "separator-2" }),
    ]);

    await expect(store.getLastAssistantMessage("agent-1")).resolves.toBe("assistant-4assistant-5");
    await expect(store.getLastAssistantMessage("missing-agent")).resolves.toBeNull();
  });

  test("hasCommittedUserMessage matches by normalized messageId and text", async () => {
    await store.bulkInsert("agent-1", [
      createRow(1, createTimelineItem("user_message", "1")),
      createRow(2, createTimelineItem("assistant_message", "2")),
    ]);

    await expect(
      store.hasCommittedUserMessage("agent-1", {
        messageId: " message-1 ",
        text: "user-1",
      }),
    ).resolves.toBe(true);
    await expect(
      store.hasCommittedUserMessage("agent-1", {
        messageId: "message-1",
        text: "different",
      }),
    ).resolves.toBe(false);
    await expect(
      store.hasCommittedUserMessage("agent-1", {
        messageId: "   ",
        text: "user-1",
      }),
    ).resolves.toBe(false);
  });
});
