import { z } from "zod";

const PersistedProjectRecordSchema = z.object({
  id: z.number().int(),
  directory: z.string(),
  kind: z.enum(["git", "directory"]),
  displayName: z.string(),
  gitRemote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

const PersistedWorkspaceRecordSchema = z.object({
  id: z.number().int(),
  projectId: z.number().int(),
  directory: z.string(),
  kind: z.enum(["checkout", "worktree"]),
  displayName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

export type PersistedProjectRecord = z.infer<typeof PersistedProjectRecordSchema>;
export type PersistedWorkspaceRecord = z.infer<typeof PersistedWorkspaceRecordSchema>;

export function parsePersistedProjectRecords(input: unknown): PersistedProjectRecord[] {
  return z.array(PersistedProjectRecordSchema).parse(input);
}

export function parsePersistedWorkspaceRecords(input: unknown): PersistedWorkspaceRecord[] {
  return z.array(PersistedWorkspaceRecordSchema).parse(input);
}

export interface ProjectRegistry {
  initialize(): Promise<void>;
  existsOnDisk(): Promise<boolean>;
  list(): Promise<PersistedProjectRecord[]>;
  get(id: number): Promise<PersistedProjectRecord | null>;
  insert(record: Omit<PersistedProjectRecord, "id">): Promise<number>;
  upsert(record: PersistedProjectRecord): Promise<void>;
  archive(id: number, archivedAt: string): Promise<void>;
  remove(id: number): Promise<void>;
}

export interface WorkspaceRegistry {
  initialize(): Promise<void>;
  existsOnDisk(): Promise<boolean>;
  list(): Promise<PersistedWorkspaceRecord[]>;
  get(id: number): Promise<PersistedWorkspaceRecord | null>;
  insert(record: Omit<PersistedWorkspaceRecord, "id">): Promise<number>;
  upsert(record: PersistedWorkspaceRecord): Promise<void>;
  archive(id: number, archivedAt: string): Promise<void>;
  remove(id: number): Promise<void>;
}

export function createPersistedProjectRecord(input: {
  id: number;
  directory: string;
  kind: "git" | "directory";
  displayName: string;
  gitRemote?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}): PersistedProjectRecord {
  return PersistedProjectRecordSchema.parse({
    ...input,
    gitRemote: input.gitRemote ?? null,
    archivedAt: input.archivedAt ?? null,
  });
}

export function createPersistedWorkspaceRecord(input: {
  id: number;
  projectId: number;
  directory: string;
  kind: "checkout" | "worktree";
  displayName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}): PersistedWorkspaceRecord {
  return PersistedWorkspaceRecordSchema.parse({
    ...input,
    archivedAt: input.archivedAt ?? null,
  });
}
