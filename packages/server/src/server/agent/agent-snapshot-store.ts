import type { ManagedAgent } from "./agent-manager.js";
import type { StoredAgentRecord } from "./agent-storage.js";

export interface AgentSnapshotStore {
  list(): Promise<StoredAgentRecord[]>;
  get(agentId: string): Promise<StoredAgentRecord | null>;
  upsert(record: StoredAgentRecord): Promise<void>;
  remove(agentId: string): Promise<void>;
  applySnapshot(
    agent: ManagedAgent,
    options?: { title?: string | null; internal?: boolean },
  ): Promise<void>;
  applySnapshot(
    agent: ManagedAgent,
    workspaceId: number,
    options?: { title?: string | null; internal?: boolean },
  ): Promise<void>;
  setTitle(agentId: string, title: string): Promise<void>;
}
