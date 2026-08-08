# RFC: 

> **** SchemaAPI 
>
>  [`docs/references/file/architecture.md`](../../../docs/references/file/architecture.md)  [`docs/references/file/file-manager-architecture.md`](../../../docs/references/file/file-manager-architecture.md)  Source of Truth
>
> 
>
> - [`file-arch-problems.md`](./file-arch-problems.md) — 
> - [`file-arch-problems-response.md`](./file-arch-problems-response.md) — 
> - [`migration-plan.md`](./migration-plan.md) —  +  + 
> - [`utils-file-migration.md`](./utils-file-migration.md) — `src/main/utils/file/` v1 `legacyFile.ts` / `fileOperations.ts` → v2 `@main/utils/file/{fs,metadata,path,search,shell}`  phase  §9.3 / §9.4  PR 

---

## 

 [`file-arch-problems.md`](./file-arch-problems.md) [`file-arch-problems-response.md`](./file-arch-problems-response.md)

 RFC **** SchemaAPI 

- ** FileEntry +  FileRef**—— mount 
- **origin: `internal` / `external` **——Cherry  vs 
- ****—— FileEntry
- **Notes /  FS-first **—— `file_entry`
- ** vs **——`FileHandle` `FileEntry`managed `FileInfo`unmanaged"" `FileMetadata` "DB """v2 **** → `FileEntry` → `FileInfo` [`architecture.md §2`](../../../docs/references/file/architecture.md#2-type-system-reference-vs-data-shape)
- **AI SDK upload **—— Vercel AI SDK Files API  PR 

---

## 

** RFC **

- `file_entry` / `file_ref`  Drizzle Schema
- DataApi+ File IPC
- FileManager createInternalEntry / ensureExternalEntry / read / write / trash / restore / permanentDelete / rename / copy
- OrphanRefScanner  checker 
- Dexie → SQLite  FileMigrator 
- Phase 1a / 1b.1-4 / 2 / X

****

-  UI  picker  PR
- Notes  RFC
- AI SDK Files API  PR`file-manager-architecture.md §9` 
- Painting  FileMigrator  fileId Painting 
-  [`migration-plan.md`](./migration-plan.md)

---

## 

- **** 1/2/3/11
- **** entry 4
- ****`file_ref`  `count` 5/7
- ****ext/type  main  13
- ** Notes** `file_entry` 9/10
- ****AI SDK uploadDirectoryTreeBuilder primitive  12

---

## Drizzle Schema

### 4.1 

|                   |                                                                                                                     |                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| FileEntry         |  `parentId` mount                                                                                         | Notes  6/10                                                      |
|               | UUID v7`uuidPrimaryKeyOrdered` v4                                                                       |  entry  v4 ID migration-plan §2.9                                |
| `origin`          | `'internal' \| 'external'`                                                                                              | Cherry  vs                                                                 |
| External path   | Global unique index on `externalPath`internal  nullSQLite UNIQUE  NULL  external  |  path `ensureExternalEntry`  upsert by path "restore trashed"          |
| `size`            | INTEGER NOT NULL                                                                                                | /external                                                          |
| trash             | `deletedAt` ** internal **external  `fe_external_no_delete` CHECK  trashed                       | internal external Active → Deleted |
| external      | `permanentDelete`  DB path-level `ops.remove`                                           | Cherry  entry-level  unlink  unmanaged       |
| `sourceType` / `role` |  Zod  +  checker                                                                                    |  sourceType  DB migration                                                                |
| `file_ref`        | UNIQUE(fileEntryId, sourceType, sourceId, role)                                                                         |                                                        |
| DataApi           |  + SQL `fs.stat`                                                                            |  mutation  File IPC                                                                        |
| Upload        |  `file_upload`                                                                                                | Vercel AI SDK Files API                                                                    |

### 4.2 fileEntryTable

```typescript
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  createUpdateTimestamps,
  uuidPrimaryKeyOrdered,
} from "./_columnHelpers";

export const fileEntryTable = sqliteTable(
  "file_entry",
  {
    id: uuidPrimaryKeyOrdered(),

    /** 'internal' | 'external' */
    origin: text().notNull(),

    /** internal  SoTexternal  basename  */
    name: text().notNull(),
    /** 'pdf' / 'md' null */
    ext: text(),
    /** internal  SoTexternal  */
    size: integer().notNull(),

    /**  origin='external'  */
    externalPath: text(),

    /**
     * ms epochnull  trash** internal **
     * external  null `fe_external_no_delete` CHECK 
     */
    deletedAt: integer(),

    ...createUpdateTimestamps,
  },
  (t) => [
    index("fe_deleted_at_idx").on(t.deletedAt),
    index("fe_created_at_idx").on(t.createdAt),
    //  externalPath internal  nullSQLite  NULL
    //  external 
    uniqueIndex("fe_external_path_unique_idx").on(t.externalPath),
    check("fe_origin_check", sql`${t.origin} IN ('internal', 'external')`),
    check(
      "fe_origin_consistency",
      sql`(${t.origin} = 'internal' AND ${t.externalPath} IS NULL) OR (${t.origin} = 'external' AND ${t.externalPath} IS NOT NULL)`,
    ),
    // External  trashedtrash/restore  internalexternal  permanentDelete
    check(
      "fe_external_no_delete",
      sql`${t.origin} != 'external' OR ${t.deletedAt} IS NULL`,
    ),
  ],
);
```

****

|            | origin='internal' | origin='external'             |
| -------------- | ----------------- | ----------------------------- |
| `name`         | SoT |  observe  basename  |
| `ext`          | SoT               |  observe          |
| `size`         | SoT               |  observe          |
| `externalPath` | NULL              | external      |

### 4.3 fileRefTable

```typescript
export const fileRefTable = sqliteTable(
  "file_ref",
  {
    id: uuidPrimaryKey(),

    fileEntryId: text()
      .notNull()
      .references(() => fileEntryTable.id, { onDelete: "cascade" }),

    /** 'chat_message' / 'knowledge_item' / 'painting' / ... */
    sourceType: text().notNull(),
    /**  IDpolymorphic, no FK */
    sourceId: text().notNull(),
    /** 'attachment' / 'source' / 'asset' / ... */
    role: text().notNull(),

    ...createUpdateTimestamps,
  },
  (t) => [
    index("file_ref_entry_id_idx").on(t.fileEntryId),
    index("file_ref_source_idx").on(t.sourceType, t.sourceId),
    uniqueIndex("file_ref_unique_idx").on(
      t.fileEntryId,
      t.sourceType,
      t.sourceId,
      t.role,
    ),
  ],
);
```



- `fileEntryId` CASCADE entry  ref
- `sourceId`  FKpolymorphic  + §
- UNIQUE

### 4.4 Upload 

Vercel AI SDK `SharedV4ProviderReference`  `file_upload`  SDK Files API  PR  [`file-manager-architecture.md §9`](../../../docs/zh/references/file/file-manager-architecture.md) Phase 1 

### 4.5 DTO 

 `src/shared/data/types/file/`managed 

|            |                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `essential.ts` | `TimestampSchema``SafeNameSchema`  schema                                                                           |
| `fileEntry.ts` | `FileEntrySchema``z.discriminatedUnion('origin')` + `.brand<'FileEntry'>()``FileEntryIdSchema``DanglingStateSchema` |
| `ref/`         | `FileRefSchema``z.discriminatedUnion('sourceType')` brand`createRefSchema`                                    |
| `index.ts`     | Barrel re-export                                                                                                            |

 `src/shared/file/types/` path-indexed 

|          |                                                                                  |
| ------------ | ------------------------------------------------------------------------------------ |
| `common.ts`  | `FilePath` / `FileType` / `PhysicalFileMetadata`                           |
| `handle.ts`  | `FileHandle` tagged union`createFileEntryHandle` / `createFilePathHandle`      |
| `info.ts`    | `FileInfo`path-indexed  §4.5.3                                       |
| `ipc.ts`     | File IPC                                                                     |
| `index.ts`   | Barrel re-export                                                                     |

### 4.5.1 Brand type  13

****`FileEntry` ****——`name/ext`  basename `type`  `ext` `refCount/dangling/path/url`  DataApi  sanctioned main  `FileMetadata`  interface——renderer /  entry 

****** `FileEntry`  brand**—— `FileEntrySchema.parse()`  `FileEntry`

```typescript
// src/shared/data/types/file/fileEntry.ts
export const FileEntryIdSchema = z.uuid(); //  brand

export const FileEntrySchema = z
  .discriminatedUnion("origin", [InternalEntrySchema, ExternalEntrySchema])
  .brand<"FileEntry">();

export type FileEntryId = z.infer<typeof FileEntryIdSchema>;
export type FileEntry = z.infer<typeof FileEntrySchema>;
```

****

- `const e: FileEntry = { id, origin, name, ... }` →  brand
- `const e = FileEntrySchema.parse(raw)` → OKZod  brand
- `const e2: FileEntry = { ...e, name: 'x' }` → spread  brand—— `rename` IPC  sanctioned mutator

**** `FileEntry`  brand`FileEntryId` / `FileRef` / `FileRefId` `z.infer` ——ID FileRef  brand  main  parse 

**** `parse`

|                                                                                                           |                                                                  |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `createInternalEntry` / `ensureExternalEntry` / `batchCreateInternalEntries` / `batchEnsureExternalEntries` IPC | `FileManager`  parse                                           |
| DataApi handlerrow → DTO                                                                                    | `src/main/data/api/handlers/files.ts`  parse shape opt-in  |
| File IPC enrichmentdangling / path / url                                                                   | `FileManager`  §                            |
| FileMigrator insert                                                                                             | `FileMigrator`  parse                                          |

**Test **`tests/__mocks__/factories.ts`  `makeFileEntry(overrides)` `FileEntrySchema.parse`——mock  schema  unbranded 

****brand  `as FileEntry`  **IPC  DataApi  parse** TS 

### 4.5.2 

```typescript
type FileEntry = z.infer<typeof FileEntrySchema>; // branded, discriminated on origin
type InternalFileEntry = z.infer<typeof InternalEntrySchema>;
type ExternalFileEntry = z.infer<typeof ExternalEntrySchema>;
type FileRef = z.infer<typeof FileRefSchema>; //  branded
type FileEntryId = z.infer<typeof FileEntryIdSchema>; //  brandedz.uuid()  v4 / v7
type DanglingState = z.infer<typeof DanglingStateSchema>; // 'present' | 'missing' | 'unknown'
```

**API DTO**DataApi  `/files/entries`  shape  `FileEntry`branded—— opt-in  `/files/entries/ref-counts`  `FileEntryRefCount[]` SQLdangling / path / url  FS/resolver  File IPC § `FileEntryView`  opt-in `refCount?` / `dangling?` / `path?` / `url?`

`FileEntryIdSchema`  `z.uuid()`  `z.uuidv7()` v4 ID migration-plan §2.9

### 4.5.3 FileInfounmanaged 

 [`src/shared/file/types/info.ts`](../../../src/shared/file/types/info.ts)

```typescript
interface FileInfo {
  readonly path: FilePath       // unmanaged 
  readonly name: string         // basename  FileEntry.name
  readonly ext: string | null   //  FileEntry.ext
  readonly size: number         // fs.stat 
  readonly mime: string         //  ext  'application/octet-stream'
  readonly type: FileType       //  ext 
  readonly createdAt: number    // fs ms epoch mtime
  readonly modifiedAt: number   // fs mtimems epoch
}
```

****`FileInfo` **path **—— `FilePathHandle`  `id` `origin` `deletedAt`""

** `FileEntry` **

|        | `FileEntry`                                     | `FileInfo`                             |
| ------------ | ----------------------------------------------- | -------------------------------------- |
|      | `id`                                            | `path`                                 |
|          |                           |                |
|      | internal  trash/restore               | ——                  |
|      | `createInternalEntry` / `ensureExternalEntry`   | `ops.stat` / `toFileInfo(entry)`       |
| brand        |  sanctioned                 |                        |
|  | `size` external  drift        | `size`  fs.stat              |

****`FileEntry → FileInfo`  `toFileInfo(entry)`  `fs.stat` +  `origin`  path ****—— `FileInfo`  `FileEntry`  `createInternalEntry` / `ensureExternalEntry``FileEntrySchema`  brand 

**** / IPC  **`FileHandle`**  `FileInfo` ——  API  managed  unmanaged`FileInfo` 

- ****`ops.stat(path)` / export  / backup 
- ****OCR / TokenService /  path +  `FileEntry`  `toFileInfo` 

 [`architecture.md §2.4`](../../../docs/references/file/architecture.md#24-signature-selection-guide)

---

## 

> FS  `ops/*`  FS ownerDB  `FileEntryService` / `FileRefService`  DB repositoryFileManager  IPC 

### 5.1 Entry `createInternalEntry` + `ensureExternalEntry`

 API  `file-manager-architecture.md §1.6`

- `createInternalEntry(params)` ——  insert UUID
- `ensureExternalEntry(params)` ——  `externalPath`  upsertreuse / insert external  trashed restore external  `size`CHECK  NULLlive  `getMetadata` 

```typescript
// CreateInternalEntryParams  source-discriminated union
//   | { source: 'path',   path: FilePath }
//   | { source: 'url',    url: URLString }
//   | { source: 'base64', data: Base64String; name?: string }
//   | { source: 'bytes',  data: Uint8Array;   name: string; ext: string | null }
// " content " hide/
//  `src/shared/file/types/ipc.ts` + `file-arch-problems-response.md`A-7 

// createInternalEntry:  /  {userData}/files/{id}.{ext}
async function createInternalEntry(
  params: CreateInternalEntryParams,
): Promise<FileEntry> {
  const id = uuidv7();
  const { name, ext, bytes } = await resolveInternalSource(params);
  const dest = resolvePhysicalPath({ id, ext, origin: "internal" });

  // 1. 
  await ops.atomicWriteFile(dest, bytes);
  const { size } = await ops.stat(dest);

  // 2.  DB
  return fileEntryService.create({ id, origin: "internal", name, ext, size });
}

// resolveInternalSource:  source  name/ext/bytes
async function resolveInternalSource(p: CreateInternalEntryParams) {
  switch (p.source) {
    case "path": {
      const bytes = await ops.createReadStream(p.path);
      return { ...splitName(path.basename(p.path)), bytes };
    }
    case "url": {
      const res = await fetch(p.url);
      return {
        ...deriveFromUrl(p.url, res.headers), //  / Content-Disposition / Content-Type
        bytes: new Uint8Array(await res.arrayBuffer()),
      };
    }
    case "base64": {
      const { mime, bytes } = decodeDataUrl(p.data);
      return {
        name: p.name ?? synthesizeName(mime),
        ext: mimeToExt(mime),
        bytes,
      };
    }
    case "bytes":
      return { name: p.name, ext: p.ext, bytes: p.data };
  }
}

// ensureExternalEntry:  externalPath  upsert
async function ensureExternalEntry(
  params: EnsureExternalEntryParams,
): Promise<FileEntry> {
  // Phase 1b.1  canonicalize: path.resolve + NFC + trailing-sep strip.
  //  fs.realpathcase-insensitive FS  Phase 2 
  //  upsert/ key 
  const canonicalPath = canonicalizeAbsolutePath(params.externalPath);
  // External  trashedfe_external_no_delete CHECK includeTrashed
  const existing = await fileEntryService.findByExternalPath(canonicalPath);
  if (existing) return existing; // name/ext  externalPathsize 

  await ops.stat(canonicalPath); //  DanglingCache
  const { name, ext } = splitName(path.basename(canonicalPath));

  return fileEntryService.create({
    origin: "external",
    name,
    ext,
    size: null, // external  sizefe_size_internal_only CHECKlive  getMetadata
    externalPath: canonicalPath,
  });
}
```

****

- `createInternalEntry` + DB  →  DB DB  →  orphan sweep  UUID 
- `ensureExternalEntry` DB  +  stat stat 

### 5.2 read / write / writeIfUnchanged

 `FileHandle``managed | unmanaged`

- `read`managed  `entryId → path`  `ops.read`unmanaged  path
- `write``ops.atomicWriteFile`external 
- `writeIfUnchanged``ops.atomicWriteIfUnchanged` `StaleVersionError`

 `file-manager-architecture.md §4-§6`

### 5.3 trash / restore internal

** DB  FS internal **——external  `fe_external_no_delete` CHECK  trashed origin external id schema 

```typescript
async function trash(id: FileEntryId): Promise<void> {
  const entry = await fileEntryService.findById(id);
  if (entry.origin === "external") {
    throw new Error(
      `Cannot trash external entry ${id}; external entries have no trashed state. Use permanentDelete.`,
    );
  }
  await fileEntryService.update(id, { deletedAt: Date.now() });
}

async function restore(id: FileEntryId): Promise<FileEntry> {
  const entry = await fileEntryService.findById(id);
  if (entry.origin === "external") {
    throw new Error(
      `Cannot restore external entry ${id}; external entries are never trashed.`,
    );
  }
  return fileEntryService.update(id, { deletedAt: null });
}
```

### 5.4 permanentDelete

 FS  origin internal external  DB  unmanaged path 

```typescript
async function permanentDelete(handle: FileHandle): Promise<void> {
  if (handle.kind === "unmanaged") {
    // Path-level  entry 
    await ops.remove(handle.path);
    return;
  }
  const entry = await fileEntryService.getById(handle.entryId);

  if (entry.origin === "internal") {
    // Cherry unlink FS +  DB
    await ops.remove(resolvePhysicalPath(entry)).catch(ignoreEnoent);
  }
  // external: entry-level  DB 
  //  unmanaged 

  await fileEntryService.delete(entry.id); // CASCADE  file_ref
}
```

### 5.5 rename

- **Entry handle, internal origin** DB  `name` UUID 
- **Entry handle, external origin**`ops.rename(oldExternalPath, newPath)` + DB  `externalPath` / `name` / `ext`
- **Path handle**`ops.rename(oldPath, newPath)` `fs.rename`

### 5.6 copy

 internal entry

```typescript
async function copy(params: {
  source: FileHandle;
  newName?: string;
}): Promise<FileEntry> {
  const sourcePath = resolveFileHandle(params.source); // → absolute FilePath
  // source: 'path'  — createInternalEntry  basename/extname  name/ext
  // newName  overridecopy  UX  core API
  const entry = await createInternalEntry({ source: "path", path: sourcePath });
  return params.newName ? rename(entry.id, params.newName) : entry;
}
```

### 5.7  orphan sweep

`FileManager.onInit`  fire-and-forget ready

1.  `{userData}/files/`  UUID  DB  entry → `unlink`
2.  `*.tmp-<uuidv7>`  → `unlink`

`DanglingCache`  DB external entries  < 10kwatcher  stat 

### 5.8  13

- **`createInternalEntry` / `ensureExternalEntry`  entry **——renderer  FileMetadata
- **`name` / `ext` **main  migration-plan §2.7
- **`type` ** `ops/metadata.getFileType(ext)` `getMetadata`  buffer  OTHER →  migration-plan §2.5

---

## 

### 6.1 

```
┌─────────────────────────────────────────────┐
│ fileEntryId CASCADE                   │
│  → file_ref           │
├─────────────────────────────────────────────┤
│                           │
│  file_ref            │
├─────────────────────────────────────────────┤
│                         │
│  sourceId  file_ref        │
└─────────────────────────────────────────────┘
```

### 6.2 fileEntryId CASCADE

`fileRefTable.fileEntryId`  `onDelete: 'cascade'`  Schema  →  `file_ref` 

### 6.3 

 Service  delete 

```typescript
// 
await fileRefService.cleanupBySource(sourceType, sourceId);

//  topic 
await fileRefService.cleanupBySourceBatch(sourceType, sourceIds);
```

****

|        |                                            |
| -------------- | -------------------------------------------------- |
|        | `cleanupBySource('chat_message', messageId)`       |
|  topic     | `cleanupBySourceBatch('chat_message', messageIds)` |
|      | `cleanupBySourceBatch('knowledge_item', itemIds)`  |
|  | `cleanupBySource('knowledge_item', itemId)`        |
|  painting  | `cleanupBySource('painting', paintingId)`          |

### 6.4 

```typescript
interface SourceTypeChecker {
  sourceType: FileRefSourceType;
  /**  sourceId ID  */
  checkExists: (sourceIds: string[]) => Promise<Set<string>>;
}

/**
 *  FileRefSourceType  checker
 *  sourceType  → TypeScript 
 */
type OrphanCheckerRegistry = Record<FileRefSourceType, SourceTypeChecker>;

class OrphanRefScanner {
  constructor(private checkers: OrphanCheckerRegistry) {}

  /**  sourceType cursor-based  */
  async scanOneType(sourceType: FileRefSourceType): Promise<number>;

  /**  sourceType */
  async scanAll(): Promise<{
    total: number;
    byType: Partial<Record<FileRefSourceType, number>>;
  }>;
}
```

**** sourceType

```typescript
const orphanScanner = new OrphanRefScanner({
  chat_message: {
    sourceType: "chat_message",
    checkExists: async (ids) => {
      const rows = await db
        .select({ id: messageTable.id })
        .from(messageTable)
        .where(inArray(messageTable.id, ids));
      return new Set(rows.map((r) => r.id));
    },
  },
  knowledge_item: {
    sourceType: "knowledge_item",
    checkExists: async (ids) => {
      /* ... */
    },
  },
  painting: {
    sourceType: "painting",
    checkExists: async (ids) => {
      /* ... */
    },
  },
  //  FileRefSourceType  checker → TypeScript 
});
```

****

-  30 Background phase
-  sourceType  5 
- ""

### 6.5 

****

- 
- ""
-  Trash

---

## API 

### 7.1 DataApi SQL shape

 `src/shared/data/api/schemas/files.ts`** SQL**—— FS main-side resolver in-memory cache shape ** opt-in ** FS IO  main-side  File IPC§7.2

```typescript
export interface FileSchemas {
  "/files/entries": {
    GET: {
      query: {
        origin?: "internal" | "external";
        inTrash?: boolean;
        sortBy?: "name" | "createdAt" | "updatedAt" | "size";
        sortOrder?: "asc" | "desc";
        page?: number;
        limit?: number;
      };
      response: OffsetPaginationResponse<FileEntry>;  //  shape
    };
  };

  "/files/entries/:id": {
    GET: {
      params: { id: FileEntryId };
      response: FileEntry;  //  shape
    };
  };

  "/files/entries/ref-counts": {
    GET: {
      query: { entryIds: FileEntryId[] };
      response: FileEntryRefCount[];  // { entryId, refCount }[]  SQL 
    };
  };

  "/files/entries/:id/refs": {
    GET: { params: { id: FileEntryId }; response: FileRef[] };
  };

  "/files/refs": {
    //  —— query  z.strictObjectsourceType / sourceId 
    GET: {
      query: { sourceType: string; sourceId: string };
      response: FileRef[];
    };
    //  POST / DELETE —— ref  service  fileRefService
  };
}
```

** opt-in ** DataApi File IPC

|  opt-in         |                                                                     |                       |
| ----------------- | ------------------------------------------------------------------------- | ------------------------- |
| `includeRefCount` | DataApi  `/files/entries/ref-counts`                              |  SQL  DataApi |
| `includeDangling` | File IPC `getDanglingState` / `batchGetDanglingStates`                    | FS-backed                 |
| `includePath`     | File IPC `getPhysicalPath` / `batchGetPhysicalPaths`                      | Main-side resolver        |
| `includeUrl`      |  `toSafeFileUrl(path, ext)``@shared/file/urlUtil` | Pure formatting +  IPC|

### 7.2 File IPC

 `src/shared/file/types/ipc.ts` FS  mutation 

|                           |                                   |                          |                                                                                                                                     |
| ----------------------------- | ------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `select`                      |                             | `string \| string[] \| null` | Electron file/folder picker                                                                                                             |
| `save`                        | `{ content, defaultPath?, filters? }` | `string \| null`             | Save dialog +                                                                                                                     |
| `createInternalEntry`         | `CreateInternalEntryIpcParams`        | `FileEntry`                  |  Cherry  entry UUID                                                                                         |
| `ensureExternalEntry`         | `EnsureExternalEntryIpcParams`        | `FileEntry`                  |  `externalPath`  upsertreuse / insertexternal  `size=null`live  `getMetadata`                                          |
| `batchCreateInternalEntries`  | `CreateInternalEntryIpcParams[]`      | `BatchOperationResult`       |  internal                                                                                                                       |
| `batchEnsureExternalEntries`  | `EnsureExternalEntryIpcParams[]`      | `BatchOperationResult`       |  upsert external path  coalesce                                                                                       |
| `read`                        | `FileHandle, opts?`                   | `ReadResult<T>`              | text / base64 / binary                                                                                                        |
| `getMetadata`                 | `FileHandle`                          | `PhysicalFileMetadata`       | `fs.stat`external  live `size` / `mtime`  —— DB  external `size`                                |
| `getVersion`                  | `FileHandle`                          | `FileVersion`                | `fs.stat`-backed origin                                                                                   |
| `getContentHash`              | `FileHandle`                          | `string`                     | xxhash-128                                                                                                                              |
| `write`                       | `FileHandle, data`                    | `FileVersion`                |                                                                                                                                   |
| `writeIfUnchanged`            | `FileHandle, data, version`           | `FileVersion`                |                                                                                                                               |
| `trash`                       | `{ id }`                              | `void`                       | DB only**Internal-only** —  external id `fe_external_no_delete` CHECK                                                |
| `restore`                     | `{ id }`                              | `FileEntry`                  |  Trash **Internal-only** — external  trashed external id                                                            |
| `permanentDelete`             | `FileHandle`                          | `void`                       |  entryInternal: unlink FS +  DB External (managed): ** DB **Unmanaged path: `ops.remove(path)`  |
| `batchTrash` / `batchRestore` |                               | `BatchOperationResult`       | internal-only                                                                                                                 |
| `batchPermanentDelete`        |                               | `BatchOperationResult`       |  permanentDelete origin                                                                                       |
| `rename`                      | `FileHandle, newTarget`               | `FileEntry \| void`          |                                                                                                                                   |
| `copy`                        | `{ source, newName? }`                | `FileEntry`                  |  internal entry                                                                                                                 |
| `open` / `showInFolder`       | `FileHandle`                          | `void`                       |  /                                                                                                            |
| `listDirectory`               | `FilePath, options?`                  | `string[]`                   |                                                                                                                                 |
| `isNotEmptyDir`               | `FilePath`                            | `boolean`                    |                                                                                                                             |
| `getDanglingState` / `batchGetDanglingStates` | `{ id }` / `{ ids }`      | `DanglingState` / `Record<id, DanglingState>` |  external entry DanglingCache +  fs.statInternal  `'present'`                        |
| `getPhysicalPath` / `batchGetPhysicalPaths`   | `{ id }` / `{ ids }`      | `FilePath` / `Record<id, FilePath>`           |  `resolvePhysicalPath(entry)` agent / drag-drop / subprocess                                       |

 [`src/shared/file/types/ipc.ts`](../../../src/shared/file/types/ipc.ts)

### 7.3 Renderer 

**DataApi  SQL  + File IPC  FS/resolver **renderer  enrichment  `useQuery`

```typescript
//  1FilesPage  +  + dangling + preview URL
const { data: entries } = useQuery(fileApi.listEntries, { origin: "internal" });
const entryIds = entries?.map((e) => e.id) ?? [];

const { data: refCounts } = useQuery(fileApi.refCounts, { entryIds });
const { data: presence } = useQuery(
  ["fileManager.batchGetDanglingStates", entryIds],
  () => window.api.fileManager.batchGetDanglingStates(entryIds),
  { enabled: entryIds.length > 0 }
);
const { data: paths } = useQuery(
  ["fileManager.batchGetPhysicalPaths", entryIds],
  () => window.api.fileManager.batchGetPhysicalPaths(entryIds),
  { enabled: entryIds.length > 0 }
);
// renderer  refCount 
// URL  IPC
//   <img src={paths && toSafeFileUrl(paths[entry.id], entry.ext)} />
// dangling presence?.[entry.id]

//  2Agent compose  IPC consumer
const { data: entries } = useQuery(fileApi.listEntries, { ids: selectedFileIds });
const { data: paths } = useQuery(
  ["fileManager.batchGetPhysicalPaths", selectedFileIds],
  () => window.api.fileManager.batchGetPhysicalPaths(selectedFileIds)
);
const filePaths = selectedFileIds.map((id) => paths?.[id]).filter(Boolean).join("\n");

//  3 File IPC
// createInternalEntry  source 
await window.api.file.createInternalEntry({
  source: "path",
  path: userPickedPath,
});
await window.api.file.createInternalEntry({
  source: "base64",
  data: dataUrl,
  name: "Pasted Image",
});
await window.api.file.createInternalEntry({ source: "url", url: downloadUrl });
await window.api.file.ensureExternalEntry({ externalPath });
await window.api.file.trash({ id });
```

---

## 

### 8.1 

|                         |                                             |                                        |
| --------------------------- | ----------------------------------------------- | ------------------------------------------ |
| ****          | Dexie `db.files` → SQLite `file_entry` ID |                                        |
| ** + ** |  `FileMetadata`   | [`migration-plan.md`](./migration-plan.md) |

### 8.2 FileMigrator

```typescript
class FileMigrator extends BaseMigrator {
  readonly id = "file";
  readonly name = "File Migration";
  readonly description = "Migrate files from Dexie to file_entry table";
  readonly order = 2.7; // After Agents(2.5), Before Knowledge(3)
}
```

**** `migrators/*.ts`  order 

```
BootConfig(0.5) → Preferences(1) → MiniApp(1.2) → Mcp(1.5) → Assistant(2)
  → Agents(2.5) → File(2.7) → Knowledge(3) → Chat(4)
                    ↑  FileEntry  migrator
```

- FileMigrator  Knowledge  Chat 
- KnowledgeChat `file_ref` 
- PaintingMigrator  Painting 

### 8.3 

**Prepare** Dexie `files`  +  + 

```typescript
async prepare(ctx: MigrationContext): Promise<PrepareResult> {
  const hasFiles = await ctx.sources.dexieExport.tableExists('files')
  if (!hasFiles) return { success: true, itemCount: 0 }

  const reader = ctx.sources.dexieExport.createStreamReader('files')
  const count = await reader.count()

  const sample = await reader.readSample(10)
  const warnings: string[] = []
  for (const file of sample) {
    if (!file.id || !file.origin_name) {
      warnings.push(`File ${file.id} missing required fields`)
    }
  }

  return { success: true, itemCount: count, warnings }
}
```

**Execute**

```typescript
async execute(ctx: MigrationContext): Promise<ExecuteResult> {
  const BATCH_SIZE = 100
  const reader = ctx.sources.dexieExport.createStreamReader('files')
  const totalCount = await reader.count()
  let processed = 0
  const fileIdMap = new Map<string, string>() // oldId → newId (1:1, ID )

  await reader.readInBatches(BATCH_SIZE, async (batch) => {
    const entries = batch.map((old) => this.transformFile(old))
    await ctx.db.insert(fileEntryTable).values(entries)
    for (const entry of entries) {
      fileIdMap.set(entry.id, entry.id)
    }
    processed += batch.length
    this.reportProgress(
      Math.round((processed / totalCount) * 100),
      `Migrated ${processed}/${totalCount} files`,
      { key: 'migration.progress.files', params: { current: processed, total: totalCount } }
    )
  })

  ctx.sharedData.set('fileIdMap', fileIdMap)
  return { success: true, processedCount: processed }
}

private transformFile(old: DexieFileMetadata): InsertFileEntry {
  const { name, ext } = splitName(old.origin_name || old.name)
  return {
    id: old.id, //  v4 IDSchema  z.uuid()
    origin: 'internal', //  Cherry 
    name,
    ext: (old.ext ?? '').replace(/^\./, '') || null,
    size: old.size ?? 0,
    externalPath: null,
    deletedAt: null,
    createdAt: new Date(old.created_at).getTime(),
    updatedAt: new Date(old.created_at).getTime()
  }
}
```

****

- **ID **`FileMetadata.id → file_entry.id`1:1 ID message blocks `fileId`knowledge items `content.id`painting `files[*].id`****
- **`origin='internal'`** Cherry  external 
- **** `{userData}/Data/Files/{id}{ext}`  `{userData}/files/{id}.{ext}` / `resolvePhysicalPath` /  migration-plan §2.7.6
- **`ext` normalize** `null`

**Validate** Dexie  `file_entry.origin='internal'` 

```typescript
async validate(ctx: MigrationContext): Promise<ValidateResult> {
  const reader = ctx.sources.dexieExport.createStreamReader('files')
  const sourceCount = await reader.count()

  const [{ count: targetCount }] = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(fileEntryTable)
    .where(eq(fileEntryTable.origin, 'internal'))

  const errors: ValidationError[] = []
  if (sourceCount !== targetCount) {
    errors.push({
      key: 'file_count_mismatch',
      expected: sourceCount,
      actual: targetCount,
      message: `Expected ${sourceCount} files, found ${targetCount}`
    })
  }

  return {
    success: errors.length === 0,
    errors,
    stats: { sourceCount, targetCount, skippedCount: sourceCount - targetCount }
  }
}
```

### 8.4  Migrator  file_ref 

**KnowledgeMigratororder=3**

```typescript
const fileIdMap = ctx.sharedData.get("fileIdMap") as Map<string, string>;

if (item.type === "file" && item.content?.id) {
  if (fileIdMap.has(item.content.id)) {
    await ctx.db.insert(fileRefTable).values({
      id: generateUUIDv7(),
      fileEntryId: item.content.id,
      sourceType: "knowledge_item",
      sourceId: newKnowledgeItemId,
      role: "source",
    });
  } else {
    logger.warn(`Skipping file_ref: entry ${item.content.id} not found`);
  }
}
```

**ChatMigratororder=4— **

> ****ChatMigrator  `file_ref` ** Batch 0 **PR #15067  defer chat  v2 file_ref  PR 

****`chat_message` **** `FileRefSourceType` `src/shared/data/types/file/ref/index.ts`  `allSourceTypes` `temp_session` / `knowledge_item` RFC  sourceType  PR a`allSourceTypes` tuple b `createRefSchema` variantc`OrphanRefScanner`  `SourceTypeChecker` chat  file_ref  Batch 0  PR 

****v1 image / file block  `block.file.id`  ChatMigrator  v2 `ImageBlock.fileId` / `FileBlock.fileId` `messageTable.data.blocks`  inline JSON chat ** inline **——****`(sourceType='chat_message', sourceId, fileEntryId)` `file_ref`  " message "  chat  file_ref service 

**** message blocks `block.type === 'file' | 'image'`  `fileId` →  `sourceType='chat_message'`  ref

> **** `block.fileId`  `fileRefTable.fileEntryId`  FK **** warning

```typescript
const fileIdMap = ctx.sharedData.get("fileIdMap") as Map<string, string>;

if ((block.type === "file" || block.type === "image") && block.fileId) {
  if (fileIdMap.has(block.fileId)) {
    fileRefsToInsert.push({
      id: generateUUIDv7(),
      fileEntryId: block.fileId,
      sourceType: "chat_message",
      sourceId: messageId,
      role: "attachment",
    });
  } else {
    logger.warn(`Skipping file_ref: entry ${block.fileId} not found`);
  }
}
```

### 8.5 Painting 

Paintings  Redux state `PaintingParams.files: FileMetadata[]`

****PaintingMigrator  Painting 

- FileMigrator  `fileEntryTable` IDPaintingMigrator  `FileMetadata.id`  `fileEntryId`  file_ref
-  PaintingMigrator painting  `file_ref` 
- `sourceType: 'painting'`  OrphanRefScanner PaintingMigrator 

### 8.6 

|                  |                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------- |
| FileMigrator     | MigrationEngine  `file_entry`origin='internal'  |
|    | Dexie `files.json`                                            |
|  | `toFileMetadata`  migration-plan §4                 |
|          |  resolver                       |

### 8.7  + 

 [`migration-plan.md`](./migration-plan.md) §2 §3Batch A-E  RFC 

---

## 

### 9.1 

```
Phase 1a ──→ Phase 1b.1 ──→ Phase 1b.2 ──→ Phase 1b.3 ──→ Phase 1b.4 ──→ Phase 2 ──→ ( PRs)
(+)   ()        (/)   (+)    ()    ()
       repo + ops       versionCache   watcher +      orphanSweep +               │
                read + canon.    + mutations    DanglingCache  Ref checker                 └──→ Phase X (AI SDK upload)
```

** 1b.x  PR**1b.1renderer  opt-in  additive 

> **2026-05**Phase 1a + 1b.1/1b.2/1b.3/1b.4  PR `feat(file): Add schema and foundation for new file module` (#13451) PR  scope ** Phase 1**§9.2-§9.6  commit-level  PRPhase 2  [§9.7](#97-phase-2filemigrator---pr) " Phase 1 "" PR "

> ** §9.3 / §9.4  `ops/*`  `@main/utils/file/*` **v1 `src/main/utils/file.ts` `legacyFile.ts` `src/main/utils/fileOperations.ts`  v2 `@main/utils/file/{fs,metadata,path,search,shell}`  phase  [`utils-file-migration.md`](./utils-file-migration.md) RFC 

### 9.2 Phase 1aContractSchemaSkeleton

********** schema**********——method body  throw `'not implemented in Phase 1a'` PR  `'deferred to Phase 2'` ops FileManager public APIIPC handlerDataApi handler  + JSDoc  Phase 1a  Phase 1b.x  PR  PR 1a "1b.x runtime  type/"

****

|          |                                                                                                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB Schema    | `src/main/data/db/schemas/file.ts` — `fileEntryTable` + `fileRefTable` CHECK `fe_origin_consistency` / `fe_external_no_delete` / `fe_size_internal_only`                                                                      |
| DB migration | `pnpm agents:generate`  SQL                                                                                                                                                                                                              |
|    | `src/shared/data/types/file/` DTOFileEntry brand DU / FileRef / DanglingState `src/shared/data/api/schemas/files.ts` DataApi schema                                                                                      |
| File     | `src/shared/file/types/ipc.ts` File IPC `src/shared/file/types/handle.ts` `FileHandle` tagged union + factory`src/shared/file/types/info.ts` `FileInfo` + `toFileInfo` **declare only**                                 |
| Source   | `FileRefSourceType`  literal union`'chat_message' \| 'knowledge_item' \| 'painting' \| 'note' \| 'temp_session'`——Phase 1b.4  checker                                                                            |
| Main     | `src/main/file/index.ts` barrel`src/main/file/ops/*`  + JSDoc + `throw NotImplemented``src/main/file/FileManager.ts` lifecycle service `src/main/file/danglingCache.ts` / `watcher/index.ts` / `internal/deps.ts` interface |
|    | **** `pathResolver.resolvePhysicalPath` + `getExtSuffix` null-byte 9                                                                                                                                                   |
| DataApi      | `src/main/data/api/handlers/files.ts` — read-only endpoint  stub / NotImplemented                                                                                                                                              |
|          | `architecture.md` / `file-manager-architecture.md`  Phase badgeRFC  Phase                                                                                                                                                     |

****

- `pnpm lint` + `pnpm build:check` 
- `src/main/file/`  interface  ops  Phase 1b.x  PR  import
- renderer  Phase 1a handlerIPC  Phase 1a  throw  acceptable
-  `// [Phase 1b.x] TODO:`  PR  TODO  1b.x  Phase 2 deferred  stub`fs.compressImage` / `path.resolvePath` / `path.isNotEmptyDir` / `shell.open` / `shell.showInFolder` / `search.listDirectory` `TODO(phase-2)`  + `throw new Error('… deferred to Phase 2')`

****

- FileManager / ops / internal / watcher / danglingCache / orphanSweep 
- `canonicalizeAbsolutePath`  Phase 1a  1b.1
- `versionCache`  interface
-  Dexie → SQLite 
- renderer 

**** merge

### 9.3 Phase 1b.1Read Path & Repository

****** + ** runtime—— renderer ****

****

- `FileEntryService` / `FileRefService` CRUD  DBread write  stub
- `ops/fs.ts`  `read` / `stat` / `exists` / `metadata` / `contentHash`xxhash-128
- `ops/path.ts`  `resolvePhysicalPath`
- `canonicalizeAbsolutePath` `path.resolve` + NFC + trailing-sep strip+ 8-10 NFC/NFD / trailing / `./a/../a` / Windows `\\` / 
- `FileManager.get*` / `read*` / `getMetadata` / `getUrl` / `findByExternalPath` / `ensureExternalEntry`upsert-only FS
- `internal/content/read.ts` / `internal/content/hash.ts` `*ByPath` 
- `dispatchHandle(handle, byEntryFn, byPathFn)` helper 
- DataApi  endpoint 
- `ops/*`  + service repo + `setupTestDatabase()` schema 

****

- renderer  `FileEntryHandle`  entry + 
- external path /NFC  entry case-sensitive FS 
-  feature-flag 

****

-  FS / rename / copy / trash / restore / permanentDelete
- versionCache interface 
- watcher / DanglingCache / orphanSweep

****Phase 1a

### 9.4 Phase 1b.2Write Path & Lifecycle

****** mutation**—— OCC trash/restore/permanentDeleterename/copy/refresh

****

- `VersionCache`  + per-process LRU
- `FileVersion`  fallback mtime  + size  content-hash 
- `ops/fs.atomicWriteFile` / `atomicWriteIfUnchanged` / `createAtomicWriteStream`tmp + rename
- `ops/fs.ts`  `write` / `copy` / `move` / `remove` / `open` / `showInFolder` / `listDirectory`ripgrep + 
- `internal/entry/create.ts` — `createInternal` / `ensureExternal`write 
- `internal/entry/lifecycle.ts` — `trash` / `restore` / `permanentDelete` + batch `permanentDelete`  —— DB  row  FS 
- `internal/entry/rename.ts` / `copy.ts` / `refresh.ts`
- `internal/content/write.ts` `*ByPath` 
- `internal/system/shell.ts` / `tempCopy.ts`
- `FileManager` facade  mutation API + `dispatchHandle` 
- atomic OCC + sizetrash/restore/permanentDelete  CHECK 

****

- renderer  FileManager 
- external entry  `trash`  DB CHECK `fe_external_no_delete`
- atomic 
- `writeIfUnchanged` + size  content-hash 

****

- watcher / DanglingCache
- orphanSweep

****Phase 1b.1

### 9.5 Phase 1b.3Watcher & DanglingCache

********——watcher DanglingCache 

****

- `createDirectoryWatcher` primitive chokidar  debounce / 
- `DanglingCache` externalPath → entryId set
- watcher  DanglingCache 
- File IPC `getDanglingState` / `batchGetDanglingStates` DataApi  dangling 
- `FileManager.subscribeDangling`  APIfuturepush-based 
- watcher →DanglingCache 

****

- external entry  → `DanglingState`  `'ok'`  `'missing'`
-  dangling 
- `DanglingCache.'unknown'` consumer MUST  not-actionable

****

-  per-path watcher
-  file_ref

****Phase 1b.2

### 9.6 Phase 1b.4OrphanSweep & FileRefCheckerRegistry

****** sweep**—— orphan entry file_ref  bucket P consumers  ref checker 

****

- `internal/orphanSweep.ts` 
- `FileManager.onInit`  fire-and-forget sweep
- `src/main/data/services/orphan/FileRefCheckerRegistry.ts` 
-  bucket P consumers  checkerchat_message / knowledge_item / painting `filemetadata-consumer-audit.md`
- sweep  metric +  +  UI
- orphan checker `Record<FileRefSourceType, SourceTypeChecker>` 

****

-  orphan entry 
-  `FileRefSourceType` variant  checker 
- RFC §6  checker 

****

- UI  Phase 2  PR
- `fs.realpath` case-insensitive FS Phase 2 additively

****Phase 1b.3

### 9.7 Phase 2FileMigrator +  PR

 **FileMigrator**§8 Dexie `db.files`  `file_entry` [`migration-plan.md §3`](./migration-plan.md)  Batch A-E 

- **Batch 0**FileMigrator KnowledgeMigrator  file_ref **ChatMigrator file_ref  chat ** §8.4 ChatMigrator PaintingMigrator  §8.5
- **Batch A**`toFileMetadata`  +  `FileMetadata`  `@deprecated`
- **Batch B**AI Core`fileProcessor` / `messageConverter` / API 
- **Batch C**Knowledge + Painting
- **Batch D**UI + state management blockmessageThunkknowledgeThunk
- **Batch E** Dexie `files` `FileMetadata`  `FileStorage``toFileMetadata` 

** Batch ** `pnpm build:check`lint + test + typecheck

****Phase 1b.4

### 9.8 Phase XAI SDK Upload PR

Vercel AI SDK Files API 

- `file_upload`  additive migration
- `FileUploadService` lifecycle service + `FileUploadRepository`
- `ensureUploaded` / `buildProviderReference` / `invalidate` 
-  `file-manager-architecture.md §9`

---

## 

|               |                                     |                                                                                                               |
| ----------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
|           | ****                                |  COW `count`                        |
|             | ****                        | schema  in-app primitive  `DirectoryTreeBuilder`§ |
| Notes         | ****                                | Notes  FS-first `origin='external'` FileEntry                                                     |
| UUID          | ** entry  v7 v4 **          | v7  time-order  insert  v4 migration-plan §2.9                                |
| External  | ** rename** |  VS Code  rename  entry  dangling                                                               |
| AI SDK upload     | ** PR**                         | FileEntry schema                                                                              |
| `count`       | ****                                |  DataApi  `/files/entries/ref-counts`  SQL migration-plan §2.3                            |
| `type`        | ****                            |  ext `getMetadata`  buffer migration-plan §2.5                                              |
| `purpose`     | ****                                |  upload migration-plan §2.2                                                     |
| `tokens`      | ****                                | 0 producer + 0 consumer migration-plan §2.4                                                           |

---

## 

|                                                                            |                                     |                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileMetadata` 274+                                              | Consumer Migration              | `toFileMetadata`  +  Batch A-E migration-plan §3                                                                                                                                                                                        |
|  `ext` /                                                     |                             |  normalize `resolvePhysicalPath` migration-plan §2.7.6                                                                                                                                                                |
| KnowledgeMigrator / ChatMigrator  `fileId`                           |  file_ref                       |  `fileIdMap`  + warn                                                                                                                                                                                                            |
| Painting  file_ref                                                       |  painting             |  Painting                                                                                                                                                                                                           |
| Phase 1  deferred-to-Phase-2 stub  `throw NotImplemented`          |                               | Phase 1  renderer  stub`fs.compressImage` / `path.resolvePath` / `path.isNotEmptyDir` / `shell.open` / `shell.showInFolder` / `search.listDirectory` Phase 2  feature-flag                        |
| External entry                                                 | entry  dangling                       | DanglingCache + File IPC `getDanglingState` / `batchGetDanglingStates`  UI  file_ref                                                                                                                                 |
| `externalPath`  FS  entrymacOS APFS / Windows NTFS | file_ref  | Phase 1b.1 `canonicalizeAbsolutePath` resolve + NFC + trailing-sep**** `fs.realpath` case ——dialog / drag-drop OS-canonical  additively  + one-off migration  |

---

##  PrimitiveDirectoryTreeBuilder

> **:(SUPERSEDED).** , PR #15363 , `docs/references/file/directory-tree.md` ,****:
>
> - : `src/main/file/tree/` →  `src/main/services/file/tree/`, file module  FileManager  primitive
> - IPC : `Tree_*` →  `File_Tree*`(`file:tree:create` / `file:tree:dispose` / `file:tree:mutation`), `file:` scope
> - :`TreeNode` / `TreeFile` / `TreeDir` / `TreeDirRoot`  `src/shared/file/types/tree.ts`,
> - : hook `useDirectoryTree(rootPath, options)`, Notes(`NotesPage`)
>
> `v2-refactor-temp/`  v2 ; SoT 

> ****:, Phase (Notes) lean ,

### 12.1 

Notes  VSCode-like  item " FS "→mutation 

 file module  **`DirectoryTreeBuilder`**  primitive `DirectoryWatcher``ops`  `src/main/file/tree/`

### 12.2 

** primitive**

- `scan(rootPath)` →  `TreeNode<T>`
-  `DirectoryWatcher` add / unlink / rename  mutate 
-  payload `TreeNode<T>` `data: T`
-  `shouldInclude(path, stat) => boolean` 

** primitive**

- UI /
-  scanlazy 
-  mutation// FS  `ops/*`  FileManager
- git 

### 12.3 

```typescript
// src/shared/file/types/tree.ts

export interface TreeNode<T = unknown> {
  path: string; // 
  name: string; // basename
  kind: "file" | "directory";
  parent: TreeNode<T> | null;
  children: TreeNode<T>[]; // file 
  data?: T; // 
}

export interface DirectoryTreeOptions<T = unknown> {
  /**  false  watcher  ignored  */
  shouldInclude?: (path: string, stat: { isDirectory: boolean }) => boolean;
  /**  payload */
  initNodeData?: (node: Omit<TreeNode<T>, "data">) => T;
  /**  DirectoryWatcher */
  watcherOptions?: Partial<DirectoryWatcherOptions>;
}

export type TreeMutationEvent<T> =
  | { type: "added"; node: TreeNode<T>; parent: TreeNode<T> }
  | { type: "removed"; node: TreeNode<T>; parent: TreeNode<T> }
  | {
      type: "renamed";
      node: TreeNode<T>;
      oldPath: string;
      newParent: TreeNode<T> | null;
    };

export interface DirectoryTreeBuilder<T = unknown> extends Disposable {
  readonly root: TreeNode<T>;
  getNode(path: string): TreeNode<T> | null;
  onMutation: Event<TreeMutationEvent<T>>;
}
```

### 12.4 

```typescript
// src/main/file/tree/factory.ts

export async function createDirectoryTree<T = unknown>(
  rootPath: string,
  options?: DirectoryTreeOptions<T>,
): Promise<DirectoryTreeBuilder<T>>;
```



1. walk `rootPath`  `shouldInclude` 
2.  `createDirectoryWatcher()`  FS  primitive DanglingCache
3.  →  mutation 
   - `onAdd` / `onAddDir` → `added`
   - `onUnlink` / `onUnlinkDir` → `removed`
   - `onRename` → `renamed` `renameDetection` 

### 12.5 

|                     |                                                                   |                  |
| ----------------------- | --------------------------------------------------------------------- | ------------------------ |
| **A. ** |  +                                                            |                    |
| **B. Lean **        | scan + watcher  + add/remove/rename mutation lazy | Notes          |
| **C. **         | lazy gitignorediff                                        |  |
| **D. **     |  Notes                                      | Phase C                |

### 12.6 

 primitive **** `file-arch-problems-response.md`  §6 / §9 / §10 

- `file_entry`  `parentId`
- Notes  `file_entry`
- ** / **

" tree " file module primitive** §6 """primitive "**—— DB

---

## 

- [x] ~~FileMigrator ~~ →  [migration-plan §2.10.2](./migration-plan.md)v1 / v2 FileMigrator  schema  ext  + 
- [x] ~~FileMigrator  migrator ~~ →  [migration-plan §2.10](./migration-plan.md) / `order=2.7` / `idRemap` & `knownIds`  migrator  /  / 
- [x] ~~~~ →  [migration-plan §3.4](./migration-plan.md)Backup-Restore  / OrphanRefScanner  gate / Dexie `files`  phasing / v1 `window.api.file.*`  / `remotefile/*` services 
- [ ] PaintingMigrator Painting  FileMigrator  fileId
- [ ] DirectoryTreeBuilder Lean  Notes 
- [ ] AI SDK FileUploadService SDK  PR
- [ ] External entry path relink §14.1

---

## 

**** Phase 

### 14.1 External entry path relink

**** external entry `externalPath`  API ****" entry `id`  FS `file_ref`"

|  API                                   |                      |  relink                                                                                    |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `rename`external                   | `ops.rename` + DB    | `fs.rename`  ENOENT                          |
| `ensureExternalEntry(newPath)`             | upsert by path           | —— entry** id** entry  dangling `file_ref`  |
| `permanentDelete` + `ensureExternalEntry` |                  | CASCADE  `file_ref`messagesknowledge                                     |

**** @  `~/Docs/report.pdf` N  `file_ref` →  Finder  `~/Archive/report.pdf`entry  dangling re-@  id N  ref  OrphanRefScanner  @——

****

```ts
// File IPC DB + DanglingCache  FS
relinkExternalEntry(id: FileEntryId, newPath: FilePath): Promise<FileEntry>;
```

****

- ** FS**—— `rename` "" vs ""
-  `id`  `file_ref`
-  `canonicalizeAbsolutePath` 
-  DanglingCache  path  path 
- `name` / `ext`  `externalPath` 

****

1. **** `newPath`  active external entry `externalPath` 
   - (a)  resolve
   - (b)  entry `file_ref`  id trashed ——
   -  **(a)** relink 
2. **** FS DanglingCacheDB  §7.1 DataApi  SQL-only ** File IPC** DataApi mutation
3. ** watcher **relink  watcher  path missing /  path added—— relink " + "
4. **** `batchRelinkExternalEntries`

****

- ——dangling UI +  re-@ 
- Phase 1b.2  `rename` / `write` relink  additive 

****

-  product-level  Notes ""
-  re-@ 
