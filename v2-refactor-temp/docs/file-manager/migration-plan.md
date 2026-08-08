# File Manager Migration Plan

> **** `FileMetadata` / `FileStorage`  v2 ****
>
> ****v2  `FileMetadata` DB  + ****
>
> - **** → `FileEntry``src/shared/data/types/file/fileEntry.ts`
> - **** → `FileInfo``src/shared/file/types/info.ts`
> - **** → `FileHandle``src/shared/file/types/handle.ts`
>
> **** FileEntry / FileInfo / **** P/I/A 
>
> ****
>
> - ****schemaAPI [`rfc-file-manager.md`](./rfc-file-manager.md)
> - **FS **main process  `fs`  [`fs-usage-audit.md`](./fs-usage-audit.md)
> - **FileMetadata **96  [`filemetadata-consumer-audit.md`](./filemetadata-consumer-audit.md)
> - **** [`docs/references/file/architecture.md`](../../../docs/references/file/architecture.md) / [`file-manager-architecture.md`](../../../docs/references/file/file-manager-architecture.md)
>
> ** RFC **RFC §10 §11****Dexie → SQLite ****** / ** RFC 

---

## 1. 

### 1.1 

|            |                                                                                                                                 |  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **** |  `FileMetadata` " FileEntry /  FileInfo / "                                                 | §2             |
| **** | messages / knowledge / painting / ... renderer  API  v2 P/I/A  FileEntry / FileInfo /  | §3             |

 shim 

### 1.2 FileMetadata 

#### 1.2.1 """ refactor"

`src/shared/data/types/file/file.ts:1-4` 

```typescript
/**
 * --------------------------------------------------------------------------
 * ⚠️ NOTICE: this type need be refactored after FileSystem is designed
 * --------------------------------------------------------------------------
 */
```

`FileMetadata` ——**DB **Dexie `files` `message_block.file` JSON****OCR TokenService UI v2 " `FileEntry`  `FileMetadata`"****

|  `FileMetadata`  | v2       |                                                                          |
| ------------------------ | ---------------- | ---------------------------------------------------------------------------- |
| DB  /        | `FileEntry`      |  `id``origin``deletedAt` lifecycleZod brand  sanctioned  |
|  /     | `FileInfo`       |  `path``modifiedAt`live view                                 |
|    | `FileHandle`     | tagged unionIPC                                                |

**" FileEntry"**—— §2

#### 1.2.2 P / I / A

[`filemetadata-consumer-audit.md`](./filemetadata-consumer-audit.md)**** 96  `FileMetadata` 

|  |                                                      |                                                 |                                                             |
| -- | ------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| **P**  |  `FileMetadata`  Dexie / message_block / knowledge_item JSON DB  | **→ FileEntry** `FileEntryId`               | `databases/index.ts` Dexie `KnowledgeMigrator``ImageMessageBlock.file` |
| **I**  |  path / name / size / ext / type  | **→ FileInfo**                                          | OCR`SupportedOcrFile`TesseractServiceTokenService`isSupportedFile` |
| **A**    |  pass-through `FileMetadata` "" | **→ ** FileEntry FileInfo | `services/FileManager.ts:addFile/uploadFile``KnowledgeService` preprocessing`InputbarCore:458` |

****

- ** P**  `FileEntry` id  `FileEntryId` PR
- ** I**  `FileInfo`** FileEntry **——shim 
- ** A** ""—— `createInternalEntry` / `ensureExternalEntry` `FileInfo`
- ****`FileInfo → FileEntry`  FileManager  sanctioned  converter

#### 1.2.3 Shim  scope 

" shimFileEntry ↔ FileMetadata"

- ** I shim**—— `FileMetadata`  `FileInfo` **** `id` / `count` / `origin_name`  boundary
- ** P shim**** P ** v2 `FileEntry`  `FileMetadata`  `FileMetadata`  `FileEntry`  Dexie 
- ** A shim******——A  shim 

See §4 for the shim function specifications.

### 1.3 

```
  filemetadata-consumer-audit.md  ────▶  migration-plan.md
  ( 96 files + P/I/A )     ()
        │
        └──   /  audit  file:line
             " + "
```

 /  audit **** audit

---

## 2. 

> **** §1.2.1 
>
> -  /  → `FileEntry`
> -  → `FileInfo`
> -  /  /  → ****upload `file_ref` TokenService  cache 
>
> " / "

### 2.1 

 `FileMetadata`  §1.2.1 

|           |           | v2                                                                                      |  |         |
| --------------- | ------------- | ------------------------------------------------------------------------------------------- | -------- | ----------- |
| `purpose?`      |       |  upload  `file_upload.metadata`                                       | §2.2     | 📋  |
| `count`         |       | `file_ref`  source                              | §2.3     | 📋  |
| `tokens?`       |       |                                                                               | §2.4     | 📋  |
| `type`          | FileInfo-only | `FileInfo.type`ext + `ops.getMetadata`  `PhysicalFileMetadata.type``FileEntry`  | §2.5     | 📋  |
| `path`          | FileInfo-only | `FileInfo.path`unmanaged managed  `resolvePhysicalPath(entry)` `FileEntry`  `path`  | §2.6     | 📋  |
| `name` () |       | `name = id + ext` storage path  `resolvePhysicalPath(entry)`  `{id}.{ext}` | §2.7     | 📋  |
| `origin_name`   | FileEntry + FileInfo | `FileEntry.name`+ `FileEntry.ext``FileInfo.name` / `FileInfo.ext`  basename  | §2.7     | 📋  |
| `created_at`    | FileEntry-only | ISO string → `FileEntry.createdAt: number`ms epochdayjs `FileInfo`  `modifiedAt`mtime entry  | §2.8     | 📋  |
| `id` (UUID v4)  | FileEntry-only |  v4 id entry  v7Schema  `z.uuid()``FileInfo`  id              | §2.9     | 📋  |
| `size` | FileEntry + FileInfo | `FileEntry.size` external  drift`FileInfo.size`  `fs.stat`  | —        | N/A         |

****📋 = 🔍 = 

### 2.2 `purpose` 

`FileMetadata.purpose?: OpenAI.FilePurpose` ""****v2 `FileEntry` 

#### 

**0  setter**

- renderer `FileManager.ts` / main `FileStorage.ts`  FileMetadata **** `purpose`—— 99%  undefined
-  setter`src/renderer/aiCore/prepareParams/fileProcessor.ts:128-132` qwen-long / qwen-doc  spread  `purpose: 'file-extract'` DB

**2 **

- `src/main/services/remotefile/OpenAIService.ts:35` — `purpose: file.purpose || 'assistants'`  `client.files.create`
- `src/renderer/aiCore/prepareParams/fileProcessor.ts:141-143` —  purpose  `file.purpose` 

**Schema **

- `src/shared/data/types/knowledge.ts:53`  `purpose`  `KnowledgeFileItem` Knowledge  ****

#### 

 `purpose` """upload "

1. FileEntry  upload 
2.  `file_upload` "** purpose **" purpose

#### 

| #   |                                                                                 |                                                                                                     |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `src/renderer/aiCore/prepareParams/fileProcessor.ts:121-132`                    |  spread `file`  `purpose`  model  upload/retrieve         |
| 2   | `src/main/services/remotefile/OpenAIService.ts:25`                                  | `uploadFile(file, options?: { purpose?: OpenAI.FilePurpose })` `options?.purpose ?? 'assistants'` |
| 3   |  preload bridge`window.api.fileService.upload`                              |  `options?.purpose`                                                                     |
| 4   | `src/renderer/aiCore/prepareParams/fileProcessor.ts:141`                        | cache mismatch `remoteFile.purpose !== purpose` `file.purpose`                    |
| 5   | `src/shared/data/types/knowledge.ts:53`                                        |  `KnowledgeFileItem` schema  `purpose`                                                        |
| 6   | `src/shared/data/types/file/file.ts:28` + `src/renderer/types/file.ts:127` | `FileMetadata.purpose?`                                                                         |

#### 

** PR v2 **

- **** purpose  FileMetadata v2 `FileEntry` qwen-long  `'file-extract'`  upload 
- **** Cleanup Batch Batch A-E consumer migration  `FileEntry → FileMetadata`  `purpose: undefined`

**PR **`refactor(file): move FilePurpose from FileMetadata to upload call sites`

####  `file_upload`  purpose 

 AI SDK  `file_upload`  [file-manager-architecture.md §9](../../../docs/zh/references/file/file-manager-architecture.md)`purpose`  `metadata` JSON 

```json
{
  "file_entry_id": "...",
  "provider": "openai",
  "remote_id": "file-abc123",
  "content_version": "xxh128:...",
  "metadata": { "purpose": "file-extract" } // per-upload, not per-file
}
```

" purpose  provider" UNIQUE  `UNIQUE(file_entry_id, provider, purpose)`

####  silent failure 

`purpose`  v1 ↔ v2 ****

1. **`OpenAIService.ts:35`** — `purpose: file.purpose || 'assistants'`
   - `file.purpose`  undefined  `'assistants'`
   -  qwen-long / qwen-doc  assistant OpenAI API 
   - 

2. **`fileProcessor.ts:141-143`** — `remoteFile.purpose !== file.purpose` 
   - `file.purpose === undefined` ≠  purpose →  mismatch →  "File purpose mismatch" 
   - OpenAI  de-dup  + 

 silent failure fallback"""API quota "CI ** #1–#6  v1 ↔ v2 shimadapter purpose ** schema 

#### Phase 2 Batch 0 2026-05

Batch 0  `src/shared/file/legacy/toFileMetadata` shim`FileEntry → FileMetadata` "" `purpose`  FileMetadata  `purpose`  `tokens`  fileProcessor / OpenAIService  v1  silent failure 

 renderer  FileManager  v2 IPC cutover  PR #15067 / 1fe5d3d34`toFileMetadata`  v1 metadata  `purpose`silent failure 


- v2 " purpose"" purpose" —— 
-  `FileEntry → FileMetadata`  §2.2 ****self-review audit  fileProcessor OpenAIService ——  PR #15067 thread `PRRT_kwDOL_2xws6EeQIz`

#### 2026-05purpose  `fileProcessor`

 Batch 0  —— **`purpose`  `fileProcessor` **

- `fileProcessor` "AI " file metadata  LLM 
- `purpose`  OpenAI Files API  provider-specific  LLM 
- qwen-long / qwen-doc → `'file-extract'`  model-name → purpose  **upload service **

 `fileProcessor` fileProcessor  OpenAI Files API  purpose  provider-specific  "model name " spread  file `file = { ...file, purpose: ... }` file  provider 

****purpose  **`FileUploadService` ** caller 

```ts
//  OpenAIServiceconcept
async uploadFile(file: FileMetadata, context?: { model?: Model }): Promise<...> {
  const purpose = inferPurpose(context?.model)  // service  model → purpose 
  return this.client.files.create({ file: /* read stream */, purpose })
}

//  fileProcessorconcept
await window.api.fileService.upload(provider, file, { model })  //  spread purpose
```

 caller  service  `options.purpose`  escape hatch —— ****

##### ""

§2.2 ""  #1 / #2 / #4 

|                                                           |                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| #1 fileProcessor  `purpose`  upload/retrieve | fileProcessor  purpose upload  `{ model }` context service    |
| #2 `uploadFile(file, options?: { purpose? })`                  | `uploadFile(file, context?: { model?: Model }, options?: { purpose? })` `inferPurpose(model) ?? options?.purpose ?? 'assistants'`  |
| #4 fileProcessor cache mismatch `remoteFile.purpose !== purpose` | de-dup  servicefileProcessor  purpose                             |

 #3 / #5 / #6 **fileProcessor  purposeservice **

### 2.3 `count` 

****

> **v2  count**`file_entry`  count  DataApi  `GET /files/entries/ref-counts?entryIds=...`  `file_ref`  trigger—— SQL  shape opt-in 

**** → `file_ref`  `count` "" Dexie-level v2  `file_ref`  `COUNT(*) WHERE fileEntryId = ?` ****

#### 2.3.1 

**Dexie schema**`src/renderer/databases/index.ts:45,49,55,62,71,80,92,105,117,128`

```
files: 'id, name, origin_name, path, size, ext, type, created_at, count'
```

v1-v10  `count`  `orderBy('count')`

**** `count: 1` setter

|                                                              |                                |
| ---------------------------------------------------------------- | ---------------------------------- |
| `src/main/services/FileStorage.ts:274`                           | `selectFiles`  FileMetadata  |
| `src/main/services/FileStorage.ts:340`                           | `uploadFile`                 |
| `src/main/services/FileStorage.ts:365`                           | `base64Image`                  |
| `src/main/services/FileStorage.ts:705`                           | `saveBase64Image`                  |
| `src/main/services/FileStorage.ts:755`                           | `savePastedImage`                  |
| `src/main/services/FileStorage.ts:1552`                          | `download`             |
| `src/main/utils/file.ts:151`                                     |  FileMetadata            |
| `src/main/knowledge/preprocess/MistralPreprocessProvider.ts:185` | OCR                      |
| `src/renderer/components/Popups/VideoPopup.tsx:110`          |  popup                     |
| `src/renderer/pages/knowledge/items/KnowledgeFiles.tsx:113`  |  uploadFile  |

#### 2.3.2 Incrementcount++

 `count++`  renderer 

|                                                                                  |                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `src/renderer/services/FileManager.ts:20` (`addFile`)                            | record  increment |
| `src/renderer/services/FileManager.ts:50` (`addBase64File`)                      | base64                                      |
| `src/renderer/services/FileManager.ts:67` (`uploadFile`)                         | upload                                      |
| `src/renderer/services/db/DexieMessageDataSource.ts:397-424` (`updateFileCount`) | `delta`-based                                   |
| `src/renderer/store/thunk/messageThunk.ts:1849`                                  |  fork / clone  `delta=+1`               |

#### 2.3.3 Decrementcount--

|                                                                                                         |                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/renderer/services/FileManager.ts:96-119` (`deleteFile(id, force=false)`)                           | `count > 1 → decrement``else → physical unlink +  Dexie` |
| `src/renderer/services/db/DexieMessageDataSource.ts:397-424` (`updateFileCount(-1, deleteIfZero=true)`) |                                                      |

#### 2.3.4 decrement 

**** file  `force=false`=  count decrement

|                                                                    |                                  |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| `src/renderer/store/thunk/messageThunk.ts:607`                       |  message block             |
| `src/renderer/store/knowledge.ts:46`                                 |  item                          |
| `src/renderer/services/MessagesService.ts:74,83`                     | `deleteMessageFiles` / `safeDeleteFiles` |
| `src/renderer/services/db/DexieMessageDataSource.ts:204,252,312,349` | block cleanup                    |

#### 2.3.5 force=true count

`src/renderer/services/FileAction.ts:45-94` (`handleDelete`)  **FilesPage **

1. `FileManager.deleteFile(fileId, true)` —  count
2. `db.message_blocks.where('file.id').equals(fileId).toArray()` — ** blocks**
3.  topics  `messages[].blocks[]` 
4. `db.message_blocks.bulkDelete(blockIdsToDelete)`

** count **——count  UI 

#### 2.3.6 UI 

|                                              |                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/renderer/pages/files/FilesPage.tsx:52`  | `db.files.orderBy('count').toArray()` — ****                      |
| `src/renderer/pages/files/FilesPage.tsx:54`  | `db.files.where('type').equals(fileType).sortBy('count')` — ** + count ** |
| `src/renderer/pages/files/FilesPage.tsx:111` | `count: file.count`  dataSource                                                   |
| `src/renderer/pages/files/FileList.tsx:102`  | `${item.count}${t('files.count')}` — **** extra       |

#### 2.3.7 Migration 

`src/main/data/migration/v2/migrators/mappings/KnowledgeMappings.ts:103`  `hasCompleteFileMetadata`  `typeof value.count === 'number'`Knowledge **`KnowledgeItemData.file`  FileMetadataSchema  SQLite** audit §5  RFC §10.6  `count`  JSON  SQLite `knowledge_item.data` 

#### 2.3.8 v2 

**`count`  `fileEntryTable`**`src/main/data/db/schemas/file.ts` 

v2 

```sql
--  file.count
SELECT COUNT(*) FROM file_ref WHERE file_entry_id = ?

--  orderBy('count')
SELECT fe.*, (SELECT COUNT(*) FROM file_ref fr WHERE fr.file_entry_id = fe.id) AS ref_count
FROM file_entry fe
ORDER BY ref_count DESC
```

#### 2.3.9 

**Step A: FileMigrator  file_refRFC §10.1-10.3 **

 Dexie **** `file_ref`

|                                                        |                         | file_ref                                                                                                    |
| ------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `message_blocks.where('file.id').equals(fileId)` → messageId |  Dexie                  | `sourceType='chat_message'`, `sourceId=messageId`, `role='attachment'`FILE blockor `'image'`IMAGE block |
| Redux `paintings` statelocalStorage export               | JSON  `painting.files[].id` | `sourceType='painting'`, `sourceId=paintingId`, `role='asset'`                                                  |
| Knowledge itemsKnowledgeMigrator                   | `KnowledgeItemData.file.id`     | `sourceType='knowledge_item'`, `sourceId=itemId`, `role='source'`                                               |

****v2 message  blocks  `data.blocks` JSON post-migration  Dexie-style `where('file.id')` ——**** file_ref `sourceId='<messageId>'` 

** §6 Q7**paintings RFC §10.4 "" paintings  file_ref  PaintingMigrator Phase 1 `'painting'` ** `FileRefSourceType` union **OrphanRefScanner  sourceType `sourceType='painting'`  `FileRefSchema.parse` PaintingMigrator ""`allSourceTypes`  `paintingSourceType` +  `createRefSchema` variant +  `FileRefCheckerRegistry`  `SourceTypeChecker`——`Record<FileRefSourceType, …>`  checker  TS Notes NoteMigrator 

**Step B: Renderer **



| #   |  /                                                                                                                                           |                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `src/renderer/services/FileManager.ts:96-119`                                                                                                    | `deleteFile`  count  IPC `permanentDelete` / `trash`                                                                                                                                                        |
| B2  | `src/renderer/services/FileManager.ts:16-27` (`addFile`)                                                                                         |  `count++`**** `file_ref`                                                                                                                                                                                           |
| B3  | `src/renderer/services/FileManager.ts:43-57` (`addBase64File`), `:59-74` (`uploadFile`)                                                          |  B2                                                                                                                                                                                                                                         |
| B4  | `src/renderer/services/db/DexieMessageDataSource.ts:397-424` (`updateFileCount`)                                                                 |  file_ref                                                                                                                                                                                                               |
| B5  | `src/renderer/store/thunk/messageThunk.ts:1849`                                                                                                  |  updateFileCount  `fileRefService.create({ sourceType: 'chat_message', sourceId, fileEntryId, role })`                                                                                                                          |
| B6  | `src/renderer/store/thunk/messageThunk.ts:607`, `MessagesService.ts:74,83`, `DexieMessageDataSource.ts:204,252,312,349`, `store/knowledge.ts:46` |  `FileManager.deleteFile(force=false)`  `fileRefService.cleanupBySource(sourceType, sourceId)`"" `OrphanRefScanner`                                                                                 |
| B7  | `src/renderer/services/FileAction.ts:45-94` (`handleDelete`)                                                                                     |  FilesPage " +  block"v2 "" `fileRefService.cleanupByEntry(entryId)` + `FileManager.permanentDelete(entryId)`message block JSON  stale  renderer  UI  dangling  |
| B8  | `src/renderer/pages/files/FilesPage.tsx:52,54,111`, `FileList.tsx:102`                                                                           |  /  `count` →  DataApi `/files/entries/ref-counts?entryIds=...`  renderer  refCount  File IPC `batchGetDanglingStates` `useQuery`                                                                                           |
| B9  |  FileMetadata  `count: 1` §2.3.1                                                                                 |                                                                                                                                                                                                                   |

**Step C: Schema **

| #   |                                                                         |                                                                                            |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| C1  | `src/renderer/databases/index.ts`                                       | Dexie `files`  `count`                                                 |
| C2  | `src/shared/data/types/file/file.ts`, `src/renderer/types/file.ts` | `FileMetadata.count`                                                                   |
| C3  | `src/main/data/migration/v2/migrators/mappings/KnowledgeMappings.ts:103`    | `hasCompleteFileMetadata`  count legacy  count |
| C4  | main  FileStorage  `count: 1`                                       | FileStorage  v2 FileManager                                            |

#### 2.3.10 

****`FileManager.deleteFile(id, force=false)`  `count === 1` 

**v2 **

- ** 1** `file_ref` trigger FileManager  `permanentDelete(fileEntryId)` trigger 
- ** 2**`OrphanRefScanner`  zero-ref UX 

** 2**

-  file_ref trigger
-  fail "undo"  message 
-  internal `deletedAt` external  orphan ""

#### 2.3.11 UI 

`FilesPage` " count ""****"v2  **DataApi  `/files/entries/ref-counts`** SQL  shape+ 

```typescript
// 1.  SQL
const { data: entries } = useQuery(fileApi.listEntries, { origin: 'internal' })
const entryIds = entries?.map((e) => e.id) ?? []

// 2.  refCountDataApi  danglingFile IPCFS  IPC
const { data: refCounts } = useQuery(fileApi.refCounts, { entryIds })
const { data: presence } = useQuery(
  ['fileManager.batchGetDanglingStates', entryIds],
  () => window.api.fileManager.batchGetDanglingStates(entryIds),
  { enabled: entryIds.length > 0 }
)

// 3. renderer  refCount 
const sorted = entries
  ?.map((e) => ({ ...e, refCount: refCounts?.[e.id] ?? 0, dangling: presence?.[e.id] }))
  .sort((a, b) => b.refCount - a.refCount)
```

DataApi ** SQL +  shape**aggregation  DataApiFS DanglingCache +  `fs.stat` File IPC `useQuery` 

`FileList`  "$N "  `/files/entries/ref-counts` 

****`FilesPage`  + refCount  query UXdangling  IPC  list  dangling  N  statPromise.all  <100ms—— IO 

#### 2.3.12 

**** PR  `purpose`

- B1-B6  file_ref  + FileManager + fileRefService Phase 2 
- B7-B8  Messages Batch E—— `FileAction.handleDelete`  `message_blocks`  Batch E 
- C1-C4  Cleanup Batch

 `count` ** Phase 2  Cleanup Batch**

#### 2.3.13 

|                                                    |                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| FileMigrator  ref  → post-migration  | migrator  Dexie `files` OrphanRefScanner      |
| Paintings  painting        | `'painting'`  `FileRefSourceType` union OrphanRefScanner  sourceTypePaintingMigrator union tuple + schema + checker |
| " ref "UX                      |  2 + "" Trash  1                  |
| FilesPage count                |  `/files/entries/ref-counts`              |

### 2.4 `tokens?` 

******100% **——

#### 2.4.1 

******0 **

- `src/main/services/FileStorage.ts`  setter  `tokens`
- `src/renderer/services/FileManager.ts`  addFile / uploadFile / addBase64File 
- `src/main/utils/file.ts` 
-  `MistralPreprocessProvider` / `VideoPopup` / `KnowledgeFiles.tsx`  `tokens:` 

******0 **

- `src/renderer/services/TokenService.ts`  `estimateImageTokens(file)`  `file.size / 100` `file.tokens`
- `estimateTextTokens(text)` `tokenx` lib FileMetadata
- UI  `file.tokens`
-  `file.tokens`

**Dexie schema**`src/renderer/databases/index.ts` v1-v10  `files: 'id, name, origin_name, path, size, ext, type, created_at, count'` ** tokens **

**Migration **`KnowledgeMappings.hasCompleteFileMetadata`  `tokens` completeness 

**Schema **

- `src/shared/data/types/file/file.ts:27` — `tokens?: number`
- `src/renderer/types/file.ts:123` — `tokens?: number`
- `src/shared/data/types/knowledge.ts:52` — `tokens: z.number().optional()`  `FileMetadataSchema` 

#### 2.4.2 

v2 **FileEntry **token  TokenService —— `purpose` 

#### 2.4.3 

** PR**

| #   |                                          |                                                               |
| --- | -------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `src/shared/data/types/file/file.ts:27` |  `tokens?: number`                                            |
| 2   | `src/renderer/types/file.ts:123`         |  `tokens?: number`                                            |
| 3   | `src/shared/data/types/knowledge.ts:52` |  `FileMetadataSchema`  `tokens: z.number().optional()`  |

****  adapter  UI 

#### 2.4.4  token 

** FileEntry ** TokenService  `estimateTextTokens` 

- `Map<contentHash, number>` — content hash  key `ops.contentHash` 
-  `token_estimate_cache` FileEntry 

 Phase 1  schema  profiling 

#### 2.4.5 

** PR** `purpose` `refactor(file): drop unused FileMetadata.tokens and .purpose fields`2-3 

#### 2.4.6 

****""—— FileMetadata  API 

### 2.5 `type: FileType` 

****`type: 'image' | 'video' | 'audio' | 'text' | 'document' | 'other'` ********`getFileType(ext)` `isTextFile(path)` buffer  OTHER → TEXT

#### 2.5.1 

**FileStorage **

`src/main/services/FileStorage.ts:237-242` —— 

```typescript
public getFileType = async (filePath: string): Promise<FileType> => {
  const ext = path.extname(filePath)
  const fileType = getFileTypeByExt(ext)
  return fileType === FILE_TYPE.OTHER && (await this._isTextFile(filePath))
    ? FILE_TYPE.TEXT
    : fileType
}
```

- **Ext **`src/main/utils/file.ts:106` `getFileType(ext)` →  `fileTypeMap` file.ts:20-28  `imageExts / videoExts / audioExts / textExts / documentExts`
- **Buffer **`FileStorage._isTextFile(filePath)`  `chardet` + `isbinaryfile` FS  sample ext  OTHER "" TEXT

** FileMetadata setter  type** count: 1 

- `FileStorage.ts:227, 273, 340, 365, 705, 755, 1552` ——  / 
- `src/main/utils/file.ts:136-145` —— `getAllFiles` `getFileType(ext)`  buffer 
- `src/renderer/components/Popups/VideoPopup.tsx:110` ——  VIDEO
- `src/renderer/pages/knowledge/items/KnowledgeFiles.tsx:113` —— 
- `src/main/knowledge/preprocess/MistralPreprocessProvider.ts:185` —— 

**Dexie schema**`files: 'id, name, origin_name, path, size, ext, type, created_at, count'` —— **`type` ** `.where('type').equals(...)` 

**v2 **`src/main/file/ops/metadata.ts`  `getFileType(path) / isTextFile(path) / mimeToExt(mime)`  `throw new Error('Not implemented')`

#### 2.5.2 32 

**A. Dexie SQL query1 **

|                                             |                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/pages/files/FilesPage.tsx:54` | `db.files.where('type').equals(fileType).sortBy('count')` ——  + count  FilesPage  query |

**B. UI  by type type **

|                                                                                   |                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/renderer/services/TokenService.ts:22, 96, 129`                               | `TEXT` →  token`IMAGE` →  size/100  token                             |
| `src/renderer/services/MessagesService.ts:145`                                    | `IMAGE` → image blockelse → file block                                                |
| `src/renderer/aiCore/prepareParams/fileProcessor.ts:28, 56, 69, 207, 244, 271`    |  `TEXT / DOCUMENT / IMAGE`  AI SDK FilePart  / base64 / URL |
| `src/renderer/aiCore/prepareParams/modelCapabilities.ts`                          |                                                         |
| `src/renderer/pages/home/Inputbar/context/InputbarToolsProvider.tsx:176`          | `files.some(f => f.type === IMAGE)` ——  mention non-vision                  |
| `src/renderer/pages/home/Inputbar/tools/components/useMentionModelsPanel.tsx:103` |                                                                                     |
| `src/renderer/pages/home/Messages/MessageEditor.tsx:214`                          | `IMAGE`                                                                   |
| `src/renderer/pages/home/Messages/MessageAttachments.tsx:47`                      | `type === undefined`                                                          |
| `src/renderer/pages/knowledge/items/KnowledgeVideos.tsx:112`                      |  `VIDEO`                                                                            |
| `src/renderer/utils/messageUtils/create.ts:108, 185`                              | IMAGE /  IMAGE  block                                                     |
| `src/renderer/hooks/useAttachment.ts`                                             |                                                                             |

**C. **

- `src/renderer/types/file.ts:140` `isImageFileMetadata(file) => file.type === FILE_TYPE.IMAGE`

**D. Dexie upgrade migrator**

- `src/renderer/databases/upgrades.ts:188` ——  Dexie  `file.type === IMAGE`

**E. Migration **

- `KnowledgeMappings.hasCompleteFileMetadata`  `typeof value.type === 'string'`

#### 2.5.3 v2 

**v2 FileEntry schema  `type` **`src/main/data/db/schemas/file.ts` 

**Ext **

- `getFileType(ext)`  `src/main/utils/file.ts`  `src/shared/file/types/`  shared renderer  main 
- `src/main/file/ops/metadata.ts`  `getFileType(path)`  path  ext →  shared  `getFileType(ext)`
-  FS IO

**Buffer **

- `src/main/file/ops/metadata.ts`  `isTextFile(path)`  `chardet` + `isbinaryfile` 
- ** `FileManager.getMetadata(handle)` **—— /  / **list **
-  FileStorage **** buffer v2 **** type """ getMetadata "

#### 2.5.4 DataApi  type filter includeType opt-in

`FilesPage`  `where('type').equals(...)`  DataApi 

****DataApi query  `type`  SQL `WHERE ext IN (...)` opt-in ** `includeType` **——DataApi  SQL +  shape type  renderer  `getFileType(ext)` 

```typescript
// DataApi handler SQL
async function listEntries(query) {
  const extFilter = query.type ? extsOf(query.type) : null
  return db
    .select()
    .from(fileEntry)
    .where(extFilter ? inArray(fileEntry.ext, extFilter) : undefined)
}

// Renderer  type IO
import { getFileType } from '@shared/file/types/fileType'
const type = getFileType(entry.ext)
```

DataApi schema 

```typescript
'/files/entries': {
  GET: {
    query: {
      ...
      type?: FileType              //  type handler  ext 
      sortBy?: ... | 'type'         //  type SQL ORDER BY ext 
    }
  }
}
```

****

-  DataApi  SQL +  shape —— opt-in 
- `getFileType(ext)` renderer 
-  SQLite generated column 

****

- list  buffer-upgraded TEXTOTHER  OTHER
-  .log/.ini  ext  OTHERsend to chat File IPC `getMetadata`  TEXT

#### 2.5.5 

**Step A: shared `getFileType` ** PR

| #   |                                            |                                                                                                             |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A1  | `src/shared/file/types/fileType.ts` |  `fileTypeMap`  `getFileType(ext)`  `src/main/utils/file.ts`  main / renderer / shared  |
| A2  | `src/main/utils/file.ts:106`                   | re-export shared                                                                                            |
| A3  | `src/main/file/ops/metadata.ts`                |  `getFileType(path)`  `isTextFile(path)` FileStorage.\_isTextFile                               |

**Step B: DataApi  type **

| #   |                                                             |                                                                                                            |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| B1  | `src/shared/data/api/schemas/files.ts`                     | query  `type?: FileType`response shape `FileEntry` opt-in           |
| B2  | DataApi handler`src/main/data/api/handlers/files.ts`  |  `type`  → `ext IN (...)` `type`  renderer  `getFileType(ext)`                   |

**Step C: FileManager IPC `getMetadata` **

| #   |                                    |                                                                   |
| --- | -------------------------------------- | --------------------------------------------------------------------- |
| C1  | `src/shared/file/types/common.ts` |  `PhysicalFileMetadata.type`  buffer            |
| C2  | `src/main/file/FileManager.ts` +   | `getMetadata(handle)`  `type`  ext OTHER  buffer  |

**Step D: **30+ 



|                  |                                                                                                 |                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| D1 AI Core           | `aiCore/prepareParams/fileProcessor.ts`, `modelCapabilities.ts`                                     | `entry.type === ...` → `getFileType(entry.ext) === ...` buffer TEXT detection `FileManager.getMetadata` |
| D2 Messages          | `MessagesService.ts`, `utils/messageUtils/create.ts`, `MessageEditor.tsx`, `MessageAttachments.tsx` |                                                                                                               |
| D3 Token             | `TokenService.ts` (line 22 / 96 / 129)                                                              | `file.type === TEXT` → `getFileType(file.ext) === TEXT` `window.api.file.read`  `getMetadata`  type     |
| D4 Input/Attachments | `InputbarToolsProvider.tsx`, `useMentionModelsPanel.tsx`, `useAttachment.ts`                        |                                                                                                                           |
| D5 Knowledge         | `KnowledgeVideos.tsx` + `KnowledgeFiles.tsx`                                                        |  ext  `type`                                                                                  |
| D6 FilesPage         | `FilesPage.tsx:54`                                                                                  | `db.files.where('type')` → DataApi `type` query param                                                                           |
| D7 Type guard        | `src/renderer/types/file.ts:140` `isImageFileMetadata`                                          |  FileEntry`(entry) => getFileType(entry.ext) === IMAGE`                                                               |

**Step E: Producer  type**

| #   |                                                                                |                                                                                         |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| E1  | `FileStorage.ts`  setter:227, 273, 340, 365, 705, 755, 1552                | v2  FileEntry  typeschema  FileMetadata shim  |
| E2  | `VideoPopup.tsx:110`, `KnowledgeFiles.tsx:113`, `MistralPreprocessProvider.ts:185` |  type                                                                           |
| E3  | `getAllFiles` /  FileMetadata  utils                             |  type                                                                                 |

**Step F: Schema **

| #   |                                          |                                                                                                                       |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| F1  | `src/renderer/databases/index.ts` v11+   | files  `type`Dexie                                                                                        |
| F2  | `src/shared/data/types/file/file.ts:22` | `FileMetadata.type`                                                                                                   |
| F3  | `src/renderer/types/file.ts:111`         |                                                                                                                       |
| F4  | `src/renderer/databases/upgrades.ts:188` |  Dexie  `file.type === IMAGE` script `getFileType(file.ext) === IMAGE`            |
| F5  | `src/shared/data/types/knowledge.ts:49` | `FileMetadataSchema.type`  knowledge domain  schema  Zod strip  type  |
| F6  | `KnowledgeMappings.hasCompleteFileMetadata`  | `typeof value.type === 'string'`                                                                                  |

#### 2.5.6 Buffer 

 `_isTextFile` **** upgradev2  `getMetadata` ****

|                                         |                                                        | v2                                                                          |                                                                     |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
|  `foo.log`.log  textExts  | FileStorage.getFileType → OTHER → buffer  TEXT →  TEXT |  ext  typelist  OTHER getMetadata  TEXT |  UX  OTHER                                  |
| TokenService  OTHER  token          | `file.type === TEXT`  → size/100   | —— TokenService  getMetadata                                  | **** bugv2  getMetadata test  |
| aiCore  OTHER                     | `file.type === TEXT / DOCUMENT`  →   |                                                                               |                                                                   |

****

-  `textExts`  .txt/.md/.html/.json/.js/.ts/.css/.py 
-  `.log``.ini``.cfg``.yaml``.yml``.toml` "/"
-  ext  list  OTHER  getMetadata 

#### 2.5.7 

|        |                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
|  | 32 + schema 3                                                                                                                |
|    | ""`entry.type === X` → `getFileType(entry.ext) === X`getMetadata DataApi query |
|      | FilesPage Dexie filter  + TokenService  buffer                                                                 |
| **** | **L**                                                                                                                        |

****

- PR1: Step A shared `getFileType` + `ops.getFileType` + `ops.isTextFile` 
- PR2: Step B DataApi `type` / `includeType` API 
- PR3: Step C `getMetadata` buffer  IPC 
- PR4-PR9: Step D  D1-D7  PR
- PR10: Step E + F cleanup

#### 2.5.8 

|                                                 |                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| FilesPage  type                     | PR2 DataApi  PR6(D6)  merge                                                 |
| TokenService  " ext " |  D3  TEXT detection  getMetadata                            |
| Dexie upgrade script  `file.type`               | upgrade script v2 migration  Dexie  |
| Buffer  regression                              | `.log`  TEXT`.bin`  sample size         |

#### 2.5.9 

 v2 FileManager / DataApi  PRA/B/C Phase 2 D Batch A-ESchema F Cleanup Batch

### 2.6 `path` 

****`path` ** path **——DB  path  SoT  `id + ext + userData` v2 """ API "

#### 2.6.1 

`src/renderer/services/FileManager.ts:80-89`  `getFile(id)`

```typescript
static async getFile(id: string): Promise<FileMetadata | undefined> {
  const file = await db.files.get(id)
  if (file) {
    const filesPath = cacheService.get('app.path.files') ?? ''
    file.path = filesPath + '/' + file.id + file.ext   // 🔑 
  }
  return file
}
```

Dexie `files`  `path` `'id, name, origin_name, path, size, ext, type, created_at, count'`** renderer **

- ** path ** getFile  db.files.get
- ** path **`{userData/files}/{id}{ext}`internal
- `FileManager.getFilePath(file)`  `FileManager.getSafePath(file)` 

" path resolution""** API**"——v2 FileEntry  path `src/main/data/db/schemas/file.ts`  helper / IPC  path

#### 2.6.2 

|                           |                                            |                                                                                                |
| ------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `FileManager.getFilePath(file)` | `src/renderer/services/FileManager.ts:91`  | `{filesPath}/{id}{ext}`                                                              |
| `FileManager.getSafePath(file)` | `src/renderer/services/FileManager.ts:140` | **** `.sh/.bat/.cmd/.ps1/.vbs/reg`  dirname  file `file://`  |
| `FileManager.getFileUrl(file)`  | `src/renderer/services/FileManager.ts:146` |  `file://{filesPath}/{file.name}` ——  `file.name` = `id+ext`     |

**`getSafePath`  v2 **—— `<img src="file://...sh">`  shell 

#### 2.6.3 ~20 

**C1. `file://` URL  UI **3 

|                                                                   |                           |
| --------------------------------------------------------------------- | ----------------------------- |
| `src/renderer/pages/home/Inputbar/AttachmentPreview.tsx:109, 112` |  tooltip  |
| `src/renderer/pages/home/Messages/MessageAttachments.tsx:39`      |                 |
| `src/renderer/pages/home/Messages/Blocks/ImageBlock.tsx:22`       |  block            |

 `file://` URL  `<img>`** async IPC** async  waterfall 

**C2.  open / reveal**3 

|                                                                  |                              |
| -------------------------------------------------------------------- | -------------------------------- |
| `src/renderer/pages/files/FilesPage.tsx:105`                     | `openPath(getFilePath(file))`    |
| `src/renderer/hooks/useAttachment.ts:26`                         |  → `openPath(path)`        |
| `src/renderer/pages/home/Inputbar/AttachmentPreview.tsx:127-129` |  → preview  openPath |

 `FileManager.open(handle)` IPC `src/shared/file/types/ipc.ts` 

**C3. FS **4 

|                                                                    |                                        |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| `src/renderer/pages/translate/TranslatePage.tsx:501, 528, 531`     | `isTextFile` / `readExternal` / `readText` |
| `src/renderer/pages/home/Inputbar/AttachmentPreview.tsx:159`       | `isTextFile(path)`                         |
| `src/renderer/pages/home/Inputbar/components/InputbarCore.tsx:465` | `readExternal(path, true)`  txt      |
| `src/renderer/utils/file.ts:113`                                   | `isSupportedFile(path, extensionSet)`      |

 `FileManager.read(handle)`  `FileManager.getMetadata(handle)`

**C4.  interop**2 

|                                                                     |                                                                                                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/pages/agents/components/AgentSessionInputbar.tsx:395` | `files.map(f => f.path).join('\n')`  agent                                                                                    |
| `src/renderer/services/NotesService.ts:191-193`                     |  path  —— **** Electron  `File.path` File  + `.path` ** FileMetadata.path** |

C4  AgentSessionInputbar  FileMetadata.path agent  LLM 

**C5. Path ** ext

|                                                             |                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `src/renderer/pages/translate/TranslatePage.tsx:492`        | `getFileExtension(file.path)` ——  `file.ext`   |
| `src/renderer/components/ObsidianExportDialog.tsx:110, 289` | fullPath  key`files.find(f => f.path === value)` |

**C6. OCR / main **5 

|                                                               |                       |
| ----------------------------------------------------------------- | ------------------------- |
| `src/renderer/services/ocr/OcrService.ts:17`                  | log                       |
| `src/renderer/services/ocr/clients/OcrExampleApiClient.ts:13` | example                   |
| `src/main/services/ocr/builtin/TesseractService.ts:74`            | `fs.stat(path)`           |
| `src/main/services/ocr/builtin/OvOcrService.ts:123`               | `ocrImage(path, options)` |
| `src/main/utils/ocr.ts:27`                                        | `readFile(file.path)`     |

 OCR —— `FileManager.withTempCopy(handle, fn)`  IPC 

**C7. Main  knowledge readers**3 

|                                                                    |                          |
| ---------------------------------------------------------------------- | ---------------------------- |
| `src/main/services/knowledge/readers/KnowledgeFileReader.ts:16, 40-45` | `reader.loadData(file.path)` |
| `src/main/knowledge/embedjs/loader/index.ts:60, 78`                    | `filePath: file.path`        |
| `src/main/knowledge/preprocess/PreprocessingService.ts:24, 29`         | log                          |

Main  main  `resolvePhysicalPath(entry)``src/main/services/file/utils/pathResolver.ts` IPC

#### 2.6.4 v2 

** IPC** File IPC 

|  renderer                             | v2                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `'file://' + FileManager.getSafePath(file)` |  renderer helper `entryToFileUrl(entry)` ——                                   |
| `FileManager.getFilePath(file)`             |  renderer helper `entryToAbsolutePath(entry)` ——                              |
| `window.api.file.openPath(path)`            | `window.api.fileIpc.open(createFileEntryHandle(entry.id))`                              |
| `window.api.file.isTextFile(path)`          | `window.api.fileIpc.getMetadata(handle)`  type buffer                     |
| `window.api.file.readText(path)`            | `window.api.fileIpc.read(handle, { encoding: 'text' })`                                 |
| `window.api.file.readExternal(path, true)`  | `window.api.fileIpc.read(handle, { encoding: 'text' })` —— path handle  ops      |
| `getFileExtension(file.path)`               | `file.ext`                                                                              |
| OCR `thirdPartyLib(file.path)`              | `fileManager.withTempCopy(entryId, path => thirdPartyLib(path))`                        |

#### 2.6.5 Path resolution  File IPC +  util 

****Renderer ****`{id}.{ext}` userData  path  main  `resolvePhysicalPath(entry)` **File IPC ** renderer—— DataApi DataApi  SQL +  shape main-side resolver 

** File IPC + ** renderer  path / URL 

|                                                              |                              |                                                         |
| ---------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| File IPC `getPhysicalPath` / **`batchGetPhysicalPaths`**         |  `FilePath`              | C4 agent drag-dropsubprocess spawn `<img src>` URL  |
|  `toSafeFileUrl(path, ext)``@shared/file/urlUtil`  | `file://` URL +  safety wrap | C1 `<img src>` / `<video src>`  renderer    |

**File IPC **`src/shared/file/types/ipc.ts` K 

```typescript
interface FileIpcApi {
  // ...
  getPhysicalPath(params: { id: FileEntryId }): Promise<FilePath>
  batchGetPhysicalPaths(params: { ids: FileEntryId[] }): Promise<Record<FileEntryId, FilePath>>
  //  getSafeUrl / batchGetSafeUrls —— " URL  IPC"
}
```

** URL **`src/shared/file/urlUtil.ts`main + renderer 

```typescript
export function isDangerExt(ext: string | null): boolean         // 
export function toFileUrl(path: FilePath): FileURLString         //  file:// 
export function toSafeFileUrl(path: FilePath, ext: string | null): FileURLString
  // = isDangerExt(ext) ? toFileUrl(dirname(path)) : toFileUrl(path)
```

Handler  `getPhysicalPath`

```typescript
// main  id 
async function batchGetPhysicalPaths(ids: FileEntryId[]) {
  const entries = await fileEntryService.batchGetById(ids)
  return Object.fromEntries(entries.map((e) => [e.id, resolvePhysicalPath(e)] as const))
}
```

**Main **

```typescript
// src/main/services/file/utils/pathResolver.ts (existing)
export function resolvePhysicalPath(entry): string { ... }  // authority 
```

** URL  IPC**`file://` URL ** path ** + ****

1. **Authority**  main —— `resolvePhysicalPath` "id + ext userData  hash-bucket"
2. **Formatting**  locality —— `toFileUrl` / `toSafeFileUrl` ** main  path string** authority util  main / renderer 

 IPC  `getSafeUrl`  main  `toSafeFileUrl(path, ext)`  `webContents.loadURL` 

** path  IPC** path resolution  `userData`  +  hash-bucket ——** authority main**Renderer  path  URL  formatting

** File IPC  DataApi  opt-in **

 DataApi `includePath` / `includeUrl` opt-in " refCount / dangling  query "****`resolvePhysicalPath` DataApi handler  DataApi ** SQL **——DataApi  SQL main-side FS statresolver in-memory cache  File IPC

 path  File IPC URL 

- Renderer  DataApi  shape  entry  File IPC  path URL  `toSafeFileUrl` 
-  cost IPC  + formatting 
- DataApi  shape 

**** renderer  +  DataApi opt-in +  IPC 

|                                   | Renderer helper  | DataApi opt-in                     | IPC  getPath+getSafeUrl | **IPC getPath +  util** |
| ------------------------------------- | ------------------------ | ------------------------------------------ | ------------------------------------- | ----------------------------------- |
| Renderer                  | ✅                     | ❌                                       | ❌                                  | ❌                                |
| Main                        | renderer         | renderer                               | renderer                          | renderer                        |
|  safety                   |  renderer          |  main                                |  main                           |  utilmain + renderer  |
| Null byte                     | renderer             | `resolvePhysicalPath`                  |                                   |                                 |
| DataApi                       | n/a                      | ❌                                     | ✅                                | ✅                              |
| IPC                               | n/a                      | 0  DataApi                       | 4 path + url  2               | **2 ** path              |
| `<img src>` cost                      |            |  query  map                    |  `useQuery` + IPC                 | **0 IPC**path URL |

Renderer helper DataApi opt-in IPC 

#### 2.6.6 

**Step A: Path resolution ** PR

| #   |                                         |                                                                                                                                 |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `src/main/services/file/utils/pathResolver.ts`       |  `resolvePhysicalPath(entry)`**** `resolveSafeUrl`——URL  util                             |
| A2  | `src/shared/file/urlUtil.ts`    | `isDangerExt(ext)` + `toFileUrl(path)` `file://` + `toSafeFileUrl(path, ext)` → dirname wrap  |
| A3  | `src/shared/file/types/ipc.ts`         |  File IPC `getPhysicalPath` / `batchGetPhysicalPaths` managed-entry-only `FileEntryId`                  |
| A4  | File IPC handlerFileManager             |  `getPhysicalPath` / `batchGetPhysicalPaths` `resolvePhysicalPath(entry)` `Promise.all`  `Record<id, path>` |

**Step B: C1  URL **

| #   |                                   |                                                                                     |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| B1  | `AttachmentPreview.tsx:109, 112, 127` | `'file://' + FileManager.getSafePath(file)` →  `useQuery`  File IPC `batchGetPhysicalPaths(ids)`  `FilePath` `toSafeFileUrl(paths[entry.id], entry.ext)`  URL |
| B2  | `MessageAttachments.tsx:39`           |                                                                                     |
| B3  | `ImageBlock.tsx:22`                   |                                                                                     |

 C1  `useQuery`DataApi  entry  shape `ext`+ File IPC `batchGetPhysicalPaths`  pathURL  `toSafeFileUrl(path, ext)` —— IPC `useEntriesWithUrl(ids)` hook

**Step C: C2 open/reveal **

| #   |                             |                                                                                                                 |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| C1  | `FilesPage.tsx:105`             | `window.api.file.openPath(FileManager.getFilePath(file))` → `window.api.fileIpc.open({ kind: 'entry', entryId })`   |
| C2  | `useAttachment.ts:26`           |                                                                                                                 |
| C3  | `AttachmentPreview.tsx:127-129` | `preview(path, name, type, ext)` →  preview  FileEntry  handle                                            |

**Step D: C3 FS **

| #   |                               |                                                                                                                              |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `TranslatePage.tsx:501, 528, 531` |  `isTextFile(path)` / `readExternal(path, true)` / `readText(path)` → `fileIpc.getMetadata(handle)` / `fileIpc.read(handle)` |
| D2  | `AttachmentPreview.tsx:159`       | `isTextFile(file.path)` → `fileIpc.getMetadata(handle)`                                                                          |
| D3  | `InputbarCore.tsx:465`            | `readExternal(targetPath, true)` → `fileIpc.read(handle)`                                                                        |
| D4  | `utils/file.ts:113`               | `isSupportedFile(file.path, ...)` →  ext`isSupportedFileExt(ext, ...)` ext                           |

**Step E: C4 Agent **

| #   |                            |                                                                                              |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| E1  | `AgentSessionInputbar.tsx:395` | `files.map(f => f.path)` →  `useQuery`  File IPC `batchGetPhysicalPaths(ids)``selectedFileIds.map(id => paths[id]).filter(Boolean).join('\n')` |

**Step F: C5 Path **

| #   |                                 |                                                              |
| --- | ----------------------------------- | ---------------------------------------------------------------- |
| F1  | `TranslatePage.tsx:492`             | `getFileExtension(file.path)` → `file.ext`                       |
| F2  | `ObsidianExportDialog.tsx:110, 289` |  `entry.id`  `entry.name`  key path  |

**Step G: C6 OCR main **

| #   |                                                                             |                                                                          |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| G1  | `src/main/services/ocr/builtin/TesseractService.ts:74`                          |  `fileManager.withTempCopy(entryId, path => ocrLogic(path))`         |
| G2  | `src/main/services/ocr/builtin/OvOcrService.ts:123`                             |                                                                          |
| G3  | `src/renderer/services/ocr/OcrService.ts:17`  `OcrExampleApiClient.ts:13` | log / example entry                                      |
| G4  | `src/main/utils/ocr.ts:27`                                                      | `readFile(file.path)` →  FileEntry `resolvePhysicalPath(entry)`  |

**Step H: C7 Main  knowledge readers**

| #   |                                        |                                                     |
| --- | ------------------------------------------ | ------------------------------------------------------- |
| H1  | `KnowledgeFileReader.ts:16, 40-45`         | `file.path` → `resolvePhysicalPath(entry)`main  |
| H2  | `knowledge/embedjs/loader/index.ts:60, 78` |                                                     |

**Step I: Legacy accessor **

| #   |                                                                                    |                          |
| --- | -------------------------------------------------------------------------------------- | ---------------------------- |
| I1  | `FileManager.getFilePath`, `getSafePath`, `getFileUrl`, `getFile`  `file.path = ...` |  shim  |
| I2  | `FileMetadata.path`                                                                |                      |
| I3  | Dexie `files`  `path`                                                          |                          |

#### 2.6.7 `readExternal`  `read`

`window.api.file.readExternal(path, asText)`  APIv2 ** `FileIpcApi.read(handle)`**

-  `readExternal(path, true)` → `read({ kind: 'path', path }, { encoding: 'text' })`
-  FileEntry `read({ kind: 'entry', entryId }, ...)`

****

#### 2.6.8 Agent  path 

C4  `AgentSessionInputbar.tsx:395`  `files.map(f => f.path).join('\n')`——

v2  File IPC  `batchGetPhysicalPaths` DataApi——main-side resolver  DataApi 

```typescript
const { data: paths } = useQuery(
  ['fileManager.batchGetPhysicalPaths', selectedFileIds],
  () => window.api.fileManager.batchGetPhysicalPaths(selectedFileIds),
  { enabled: selectedFileIds.length > 0 }
)
const filePaths = selectedFileIds.map((id) => paths?.[id]).filter(Boolean).join('\n')
```

IPC  `Promise.all`  RT —— `useQuery`  query  opt-in flag 

#### 2.6.9 

|                                        |                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ****                       | `entryToSafePath`  `isDangerFile` FileManager IPC `open(handle)`  danger ext  refuse  open dirname                                               |
| **Image render **C1          | Helper  `getSafePath`  db.files.get                                                                                                        |
| ** key **C5 F2     | Obsidian dialog  entry.id  key path                                                                                                    |
| ** `readExternal` **       | `readExternal`  `read({ kind: 'path', path })`                                                                                         |
| ** message block  FileMetadata** | ChatMigrator  `file.id`  file_ref`sourceType='chat_message'` message block JSON  `fileEntryId` FileEntry** shim** §2.6.10 Q3 |
| **Drag-drop  Cherry  OS**              | Electron drag-drop  `entryToAbsolutePath(entry)`                                                                                                   |

#### 2.6.10 

|        |                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------- |
|  | ~20 + main side 5                                                                                  |
|    | " API "                                                          |
|  |  FileMetadata → FileEntry shim OCR providers  withTempCopy |
| **** | **L–XL** type  UI  + main                                  |

** 8-10  PR**Step A-I 

- Step Ahelper Step B-Frenderer  Phase 2 
- Step G-Hmain  FileManager 
- Step Ilegacy Cleanup Batch

#### 2.6.11 

**Q1: `readExternal`  IPC ** ✅ ****

 `read(handle)` `readExternal` FileHandle  `entry`  `path`  `readExternal(path, text)`  `read({ kind: 'path', path }, { encoding: 'text' })`

Step D  `readExternal` **** `readText` / `isTextFile`  IPC  `read` / `getMetadata`

**Q2: ******

 C1–C7 **2  renderer **

|                                                              |  path?                                      | /                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| **C1 `file://` URL **`<img src="file://...">` × 3  | ✅ ****renderer         | `<img>/` `<video>`  URL `entryToFileUrl`                         |
| C2  open / reveal                                            | ❌                                        | `fileIpc.open(handle)` / `showInFolder(handle)`                                      |
| C3 FS                                                    | ❌                                        | `fileIpc.read(handle)` / `getMetadata(handle)`                                       |
| **C4 Agent  embedding**                                    | ✅ ****LLM  |  path  compose async IPC  renderer  helper |
| C5 Path ext / basename                               | ❌                                        |  `entry.ext` / `entry.name`                                                        |
| C6 OCR main                                        | ✅ main                                 | `withTempCopy(entryId, fn)`  pathrenderer                        |
| C7 Knowledge readermain                                    | ✅ main                                 | main  `resolvePhysicalPath(entry)`renderer                               |

****** C1  C4  renderer **

- **C1 **image render  async
- **C4 **async IPC  C1  helperC4 

 renderer  path helper ****

**Q3:  message block  FileMetadata ** ✅ ****

**** message blocks  `file: FileMetadata`  v2  `file_ref` `sourceType='chat_message'`, `sourceId=messageId`, `fileEntryId=...`, `role='attachment' | 'image'`

****

- ✅ **Batch 0 **v2 message block JSON  `fileEntryId: string``ImageBlock.fileId` / `FileBlock.fileId` id  FileEntryChatMigrator  v1 `block.file.id` → v2 `fileId` shim  path——block JSON  path 
- ⏳ ****`file_ref`  chat  v2 file_ref  `'chat_message'` sourceType §2.10.3  ChatMigrator  inline `fileId`  file_ref 

 §2.3count  file_ref + RFC §8.4 ChatMigrator 

**Q4: Path  renderer ** ✅ ****

** File IPC **——renderer main  path 

- `getPhysicalPath` / `batchGetPhysicalPaths` → agent / drag-drop / subprocess
-  `toSafeFileUrl(path, ext)``@shared/file/urlUtil`→ `file://` URL +  safety wrap`<img src>` / `<video src>` IPC

** DataApi opt-in**DataApi ** SQL +  shape ** main-side resolver FS statin-memory cache  File IPC DataApi handler  `resolvePhysicalPath`  main-side " SQL "——consumer  IO

****

- Renderer-side `entryToFileUrl / entryToAbsolutePath` helper renderer
- DataApi `includePath` / `includeUrl` opt-in  main-side  SQL 



- DataApi  DataApi  =  SQL File IPC  = 
- Renderer  path / url  `useQuery`
- Batch IPC  `Promise.all`
- Main subdir sharding  renderer
-  safety  main
- Null byte 

### 2.7 `name` / `origin_name` 

****

|         |                                        | v2                                                                                   |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `name`        |  = `{id}.{ext}`  | **** `resolvePhysicalPath(entry)`  `{id}.{ext}`              |
| `origin_name` |  = `My Document.pdf` | **** → `FileEntry.name='My Document'`+ `FileEntry.ext='pdf'` |

#### 2.7.1 `name`

**ProducerFileStorage ** `FileStorage.ts`  setter  `name: uuid + ext`  `path.basename(...)` "id + ext" `createInternalEntry` / `ensureExternalEntry`  renderer

**Renderer **

|                                                                           |                                                                                                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/services/FileManager.ts:148` `getFileUrl`                   | `file://${filesPath}/${file.name}`  URL—— `getFileUrl`  `getFilePath`  `getSafePath` §2.6  |
| `src/renderer/services/KnowledgeService.ts:135`                           | `[${item.file.origin_name}](http://file/${item.file.name})`  markdown                                                                |
| `src/renderer/utils/knowledge.ts:211, 222`                                | XML  `<file filename="${fileBlock.file.name}">` ——  LLM                                                                            |
| `src/renderer/pages/knowledge/components/KnowledgeSearchItem/hooks.ts:54` | `href: http://file/${item.file.name}`                                                                                                        |
| `src/renderer/hooks/useKnowledge.ts:134, 138`                             | `window.api.file.delete(file.name)`  API                                                                                       |

**** `file.name`  **Electron  browser `File`  `.name`** FileMetadata`PasteService.ts:72-73`, `useRichEditor.ts:493`, `ObsidianExportDialog.tsx:112`, `VideoPopup.tsx:98-109`, `NotesService.ts:321`Dirent****

#### 2.7.2 `origin_name`

**Producer**
|  |  |
|---|---|
| `FileStorage.ts:215, 267, 315, 358, 698, 748, 1545` | `path.basename(filePath)` —— basename |
| `src/main/utils/file.ts:152` | `getAllFiles`  basename |
| `knowledge/utils/directory.ts:71` | Knowledge  |
| `knowledge/preprocess/Mistral/Mineru/Paddleocr`  |  `.pdf` → `.md`|
| `VideoPopup.tsx:111`, `KnowledgeFiles.tsx:114` | renderer  |

**Consumer**
|  |  |
|---|---|
| `src/renderer/services/FileAction.ts:18, 19, 37` | `tempFilesSort`  `temp_file` `sortFiles`  name  |
| `src/renderer/services/FileAction.ts:100-102` | rename `newName`  popup  `origin_name` |
| `src/renderer/services/FileManager.ts:159-175` `formatFileName` | `pasted_text` / `temp_file image`  i18n origin_name |
| `src/renderer/services/FileManager.ts:151-157` `updateFile` |  `origin_name`  ext ext |
| `src/main/services/remotefile/OpenAIService.ts:31, 46, 57` | OpenAI  `name: file.origin_name` / `displayName` |
| `src/main/services/remotefile/GeminiService.ts:38, 60, 79` | Gemini  `displayName` |
| `src/main/services/remotefile/MistralService.ts:28, 36, 47` | Mistral  `fileName` / `displayName` |
| `src/renderer/aiCore/prepareParams/messageConverter.ts:82, 149, 159, 161, 162` | AI SDK FilePart `fileName`log / toast |
| `src/renderer/services/KnowledgeService.ts:135` | markdown  `[${item.file.origin_name}](...)` |
| `src/renderer/services/ApiService.ts:473` | `fileBlocks.map(fb => fb.file.origin_name)`  |
| `src/renderer/components/RichEditor/useRichEditor.ts:523` | `alt: fileMetadata.origin_name` |
| `src/main/knowledge/preprocess/*`  | `file.origin_name.replace('.pdf', '.md')`  |

**Dexie schema**: `files: 'id, name, origin_name, path, size, ext, type, created_at, count'`—— indexed column

**Migration **: `KnowledgeMappings.hasCompleteFileMetadata`  `typeof value.origin_name === 'string'`

#### 2.7.3 v2 FileEntry 

```typescript
// src/shared/data/types/file/fileEntry.ts (already set up)
interface FileEntry {
  id: string; // UUID v7
  origin: "internal" | "external";
  name: string; // ****'My Document'
  ext: string | null; // ****'pdf' null
  size: number;
  externalPath: string | null;
  // deletedAt  internal external  nullfe_external_no_delete CHECK
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
```



- `name` ****"id+ext"""
- `ext` ****"`.pdf`""`pdf`"—— §2.5 type  `ext` 
-  = `name + (ext ? '.' + ext : '')`

#### 2.7.4 

shared  renderer 

```typescript
// src/shared/file/utils/displayName.ts
export function entryDisplayName(entry: FileEntry): string {
  return entry.ext ? `${entry.name}.${entry.ext}` : entry.name;
}
```

 `file.origin_name`  `entryDisplayName(entry)`

#### 2.7.5 

**Step A: `entryDisplayName` ** PR

| #   |                                               |                            |
| --- | ------------------------------------------------- | ------------------------------ |
| A1  | `src/shared/file/utils/displayName.ts` |  `entryDisplayName(entry)` |

**Step B: Producer **

| #   |                                                                                    |                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `FileStorage.ts`  setter:215, 267, 315, 358, 698, 748, 1545                    | v2 entry `name`  basename`ext`  storage name `name=id+ext`storage path  `resolvePhysicalPath`  |
| B2  | `src/main/utils/file.ts:152`                                                           |                                                                                                                                                            |
| B3  | `src/main/knowledge/utils/directory.ts:71`                                             |                                                                                                                                                            |
| B4  | `src/main/knowledge/preprocess/*`Mistral / Mineru / Paddleocr / OpenMineru / Doc2x | `name` `ext`                                                                                                         |
| B5  | `VideoPopup.tsx:98-111`, `KnowledgeFiles.tsx:113-114`                                  | renderer                                                                                                                                         |

**Step C: Consumer  —— **

| #   |                                 |                                                                                            |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| C1  | `FileManager.getFileUrl` (line 148) |  File IPC `getPhysicalPath` +  `toSafeFileUrl(path, ext)`  helper          |
| C2  | `KnowledgeService.ts:135`           | `http://file/${file.name}` → `http://file/${entry.id}` id                    |
| C3  | `utils/knowledge.ts:211, 222`       | XML  `filename="..."`  `entryDisplayName(entry)`                                           |
| C4  | `KnowledgeSearchItem/hooks.ts:54`   | `href: http://file/${item.file.name}` → `${entry.id}`                                          |
| C5  | `useKnowledge.ts:134, 138`          | `window.api.file.delete(file.name)` → `fileIpc.permanentDelete(createFileEntryHandle(entry.id))` |

**Step D: Consumer  —— **

| #   |                                                                                          |                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `FileAction.ts:18, 19`                                                                       | `origin_name.startsWith('temp_file')` → `entry.name.startsWith('temp_file')`v2 name                                           |
| D2  | `FileAction.ts:37`                                                                           | `a.origin_name.localeCompare(b.origin_name)` → `a.name.localeCompare(b.name)`  `entryDisplayName(a).localeCompare(entryDisplayName(b))` |
| D3  | `FileAction.ts:100-102` rename                                                               | popup  `entry.name` `name``ext`                                                                     |
| D4  | `FileManager.formatFileName` (renamed/ rewritten)                                            | `entry.name.includes('pasted_text')`  `entryDisplayName` formatFileName                                         |
| D5  | `FileManager.updateFile:151-157`                                                     | v2 name  ext                                                                                                    |
| D6  | `OpenAIService.ts:31, 46, 57`, `GeminiService.ts:38, 60, 79`, `MistralService.ts:28, 36, 47` | `file.origin_name` → `entryDisplayName(entry)`                                                                                            |
| D7  | `messageConverter.ts:82, 149, 159, 161, 162`                                                 |                                                                                                                                       |
| D8  | `KnowledgeService.ts:135` markdown                                                       |  `[${entryDisplayName(entry)}](...)`                                                                                              |
| D9  | `ApiService.ts:473`                                                                          | `fileBlocks.map(fb => entryDisplayName(fb.file))`                                                                                         |
| D10 | `useRichEditor.ts:523` alt                                                                   | `alt: entryDisplayName(entry)`                                                                                                            |
| D11 | `knowledge/preprocess/*`                                                           | `file.origin_name.replace('.pdf', '.md')` →  `name: entry.name, ext: 'md'`  `entryDisplayName`  replace                           |

**Step E: Schema / **

| #   |                                                                         |                                                                     |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| E1  | `src/shared/data/types/file/file.ts`, `src/renderer/types/file.ts` | FileMetadata  `name` / `origin_name` Cleanup Batch                  |
| E2  | `src/renderer/databases/index.ts`                                       | Dexie `files`  `name`, `origin_name` v11+ upgrade         |
| E3  | `src/shared/data/types/knowledge.ts:45`                                | `FileMetadataSchema`  `name` / `origin_name`                      |
| E4  | `KnowledgeMappings.hasCompleteFileMetadata`                                 |  `origin_name` `name`+ `ext`                |
| E5  | `FileMigrator`                                                              | `origin_name` →  `name`  `ext` `name` |

#### 2.7.6 `ext`  §2.5

 `FileMetadata.ext = '.pdf'`****v2 `FileEntry.ext = 'pdf'`****



- `file.ext === '.pdf'` → `entry.ext === 'pdf'`
- `file.ext.replace('.', '')`  hacky 
- Producer `path.extname()`  `.pdf` `.slice(1)`  `.replace(/^\./, '')`

 §2.5 `type` **** PR 

#### 2.7.7 `FileMigrator` 

Dexie `origin_name: 'My Doc.pdf'` + `ext: '.pdf'` → v2:

```typescript
const oldExt = oldFile.ext.startsWith('.') ? oldFile.ext.slice(1) : oldFile.ext
const oldOriginName = oldFile.origin_name
const newName = oldExt && oldOriginName.endsWith('.' + oldExt)
  ? oldOriginName.slice(0, -(oldExt.length + 1))
  : oldOriginName
const newExt = oldExt || null

newFileEntry = {
  ...
  name: newName,  // 'My Doc'
  ext: newExt,    // 'pdf'
}
```

 `origin_name`  `ext` bug 

#### 2.7.8 Rename 

`updateFile({ ...file, origin_name: newName })` **** `'My New Doc.pdf'` 

v2rename popup  `name``ext`  `'My New Doc'` `entry.name = 'My New Doc'``ext='pdf'` 

**UX **

- Rename popup  placeholder / tip ""
-  internal  `name`  DB `{id}.{ext}`
-  external  rename  `{newName}.{ext}`rename `externalPath`

 §2.6 Step I  FileManager rename 

#### 2.7.9 

|           |                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------- |
|  producer | ~10                                                                                             |
|  consumer | ~15                                                                                             |
|       | ext rename                                      |
|         | Remote upload OpenAI/Gemini/Mistral display name  provider  |
| ****    | **M** count  path                                                                     |

****

- PR1: Step A
- PR2: Step E4 + E5FileMigrator  + schema —— 
- PR3-PR5: Step BProducer main  /  / renderer  PR
- PR6-PR9: Step D consumer  PRFileAction / TokenService / Remote upload / aiCore & RichEditor 
- PR10: Step E1-E3 cleanup schema

#### 2.7.10 

|                                                  |                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Remote upload  `displayName`           | `entryDisplayName`                                                                                    |
|  `.pdf` → `.md`                      |  ext  ext                                                                                 |
|  `origin_name`  extbug                 | FileMigrator ext  null  name  origin_name                                                           |
| `formatFileName`  `pasted_text` / `temp_file`  |  `origin_name='pasted_text_xxx.txt'`  `name='pasted_text_xxx'`identifier  |
| Dexie                                        |  v11 upgrade                                                                        |

### 2.8 `created_at: string` 

****ISO 8601 string → `FileEntry.createdAt: number`ms epoch `dayjs` `dayjs()`  string  number Producer  setter  Migrator 

#### 2.8.1 

**v2  schema**`FileEntry.createdAt: number`ms epoch v2  `src/main/data/db/schemas/file.ts`

**Producer ISO string  `.toISOString()` / `birthtime.toISOString()`**

|                                                                   |                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/main/services/FileStorage.ts:224, 270, 336, 361, 701, 751, 1548` |  setter`stats.birthtime.toISOString()`  `new Date().toISOString()` |
| `src/main/utils/file.ts:154, 325, 361`                                | `new Date().toISOString()` / `stats.birthtime.toISOString()`             |
| `src/main/knowledge/utils/directory.ts:37, 51, 74`                    | `stats.birthtime.toISOString()`                                          |
| `src/main/knowledge/preprocess/MistralPreprocessProvider.ts:181`      | `new Date().toISOString()`                                               |
| `src/main/knowledge/preprocess/BasePreprocessProvider.ts:57`          | `processedStats.birthtime.toISOString()`                                 |
| `src/renderer/components/Popups/VideoPopup.tsx:113`               | renderer  `new Date().toISOString()`                               |
| `src/renderer/pages/knowledge/items/KnowledgeFiles.tsx:116`       | renderer                                                           |

**Consumer `dayjs` **

|                                                                             |                                                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/renderer/services/FileManager.ts:164`                                  | `dayjs(file.created_at).format('YYYY-MM-DD')` — `formatFileName`  pasted_text  |
| `src/renderer/services/FileAction.ts:31`                                    | `dayjs(a.created_at).unix() - dayjs(b.created_at).unix()` —                |
| `src/renderer/pages/files/FilesPage.tsx:114, 115`                           | `dayjs(file.created_at).format('MM-DD HH:mm')` + `dayjs(file.created_at).unix()`         |
| `src/renderer/pages/home/Inputbar/tools/components/AttachmentButton.tsx:79` | `dayjs(fileContent.created_at).format('YYYY-MM-DD HH:mm')`                               |

******`dayjs(x)`  `string` (ISO)  `number` (ms epoch)**v2  number  `dayjs` ****

**Dexie upgrades**

- `src/renderer/databases/upgrades.ts:48-49` —  bug  `created_at instanceof Date` `toISOString()`v2  Dexie 

**Migration **

- `KnowledgeMappings.hasCompleteFileMetadata``KnowledgeMigrator.ts:71` — `typeof value.created_at === 'string'` **** Dexie 
- `store/knowledge.ts:74` —  pattern`new Date(item.created_at).getTime()`  ms epoch

#### 2.8.2 

**Step A: Producer ** mechanical 

| #   |                                                     |                                                                        |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| A1  | `FileStorage.ts:224, 270, 336, 361, 701, 751, 1548`     | `.toISOString()` → `.getTime()``new Date().toISOString()` → `Date.now()` |
| A2  | `src/main/utils/file.ts:154, 325, 361`                  |                                                                        |
| A3  | `knowledge/utils/directory.ts:37, 51, 74`               |                                                                        |
| A4  | `knowledge/preprocess/MistralPreprocessProvider.ts:181` |                                                                        |
| A5  | `knowledge/preprocess/BasePreprocessProvider.ts:57`     | `processedStats.birthtime.toISOString()` → `processedStats.birthtimeMs`    |
| A6  | `VideoPopup.tsx:113`, `KnowledgeFiles.tsx:116`          |                                                                        |

**Step B: Consumer  no-op**

`dayjs(x)`  number

- `dayjs(file.created_at).format(...)` —— 
- `dayjs(a.created_at).unix()` —— 

`.unix()`  `Math.floor(x / 1000)` 

**Step C: Schema / Migrator**

| #   |                                                                                |                                                                                                            |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| C1  | `src/shared/data/types/file/file.ts:25`, `src/renderer/types/file.ts:116` | `FileMetadata.created_at: string` → `number` stringv2  FileEntry  numberCleanup Batch  |
| C2  | `KnowledgeMappings.hasCompleteFileMetadata``KnowledgeMigrator.ts:71`             |  `typeof value.created_at === 'string' \|\| typeof value.created_at === 'number'`          |
| C3  | FileMigrator mapping                                                               | `new Date(oldFile.created_at).getTime()`  string                                           |
| C4  | `src/renderer/databases/index.ts` Dexie schema                                 | Dexie                                                                    |

#### 2.8.3 

|           |                                |
| ------------- | ---------------------------------- |
|  Producer | ~11                            |
|  Consumer | ~4  dayjs        |
| ****    | **S** tokens |

****

- ****`dayjs` FileMigrator  `new Date(iso).getTime()`  pattern
- historical bug  `Date`  string upgrade script :48——FileMigrator  `created_at`  `typeof`  `Date.now()`

**** PR §2.4 tokens "" PR ext 

### 2.9 `id: UUID v4 → UUID v7` 

****

> ** v4 ID** entry  v7 `FileEntryIdSchema`  `z.uuid()` 

#### 2.9.1 

**v2 **

- **DB schema**`src/main/data/db/schemas/file.ts:25``id: uuidPrimaryKeyOrdered()` ——  entry  **UUID v7**`_columnHelpers.ts:26`
- **Zod **`src/shared/data/types/file/fileEntry.ts:64``FileEntryIdSchema = z.uuidv7()` —— ** v7**
- ****`fileEntry.test.ts:188-199` v4 

** FileMetadata ID  v4**
|  |  |
|---|---|
| `src/main/services/FileStorage.ts:266, 314, 357` | `uuidv4()` |
| `src/main/utils/file.ts:145` | `uuidv4()`getAllFiles|
| `src/main/services/knowledge/utils/directory.ts:32, 46, 70` | `uuidv4()` |
| `src/renderer/store/thunk/knowledgeThunk.ts:42` | `uuidv4()` |

DB  `id: text()``_columnHelpers.ts:18, 27`——**SQLite TEXT  UUID **v4/v7  Zod runtime 

#### 2.9.2 

**Option A:  v4 +  Schema**

- FileMigrator  v4 id  `file_entry.id`
- message_blockspaintingsknowledge_itemsfile_ref****—— id 
-  `FileEntryIdSchema`  `z.uuidv7()`  `z.uuid()` v4  v7 
-  entry  `uuidPrimaryKeyOrdered()`  v7

**Option B:  v7 + ID **

- FileMigrator  entry  v7 id `oldId → newId` 
-  file message_blocks.file.idpaintings.files[].idknowledge_items.data.file.idfile_ref.fileEntryId
-  strict v7 invariant

****

|                   | Option A v4                                                      | Option B v7             |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| Migrator        |                                                            | **** +      |
|           |                                                                      |  dangling |
| DB-level        | v4/v7  SQLite TEXT                                         |  v7                           |
| v7 time-ordering  |  entry  entry  v4  |                         |
| Schema          | `z.uuid()`  UUID                                                 | `z.uuidv7()`                |
|               | SQLite  v4/v7                                          |                         |

** Option A **

1. v7 "** insert **" B-tree v7 
2.  ID  bug orphan
3. `z.uuid()`  garbage  schema validation 
4.  `pathResolver`  + 

#### 2.9.3 

**Step A:  Schema** PR FileMigrator 

| #   |                                                              |                                                                                                             |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A1  | `src/shared/data/types/file/fileEntry.ts:64`                | `FileEntryIdSchema = z.uuidv7()` → `z.uuid()`                                                                   |
| A2  | `fileEntry.ts:56-63` JSDoc                                       | "File entry ID: UUID v7" → "File entry ID: UUID (v4 for legacy migrated entries, v7 for entries created in v2)" |
| A3  | `src/shared/data/types/__tests__/fileEntry.test.ts:188-199` |  assert v4 **pass** failv7 pass UUID  fail                                              |

**Step B: FileMigrator **

```typescript
// 
async function migrateFileEntry(oldFile: DexieFileRow): Promise<FileEntryRow> {
  return {
    id: oldFile.id, //  v4 id
    origin: isInternalPath(oldFile.path) ? "internal" : "external",
    name: stripExt(oldFile.origin_name, oldFile.ext),
    ext: normalizeExt(oldFile.ext), // '.pdf' → 'pdf'
    size: oldFile.size,
    externalPath:
      oldFile.origin === "external"
        ? canonicalizeAbsolutePath(oldFile.path)
        : null,
    deletedAt: null, // Dexie external  trashedfe_external_no_delete
    createdAt: toMs(oldFile.created_at), // ISO → ms
    updatedAt: toMs(oldFile.created_at), // Dexie  updatedAt createdAt
  };
}
```

**External path ** schema  `UNIQUE(externalPath)`  Dexie  canonical path  external FileMetadata case / NFD / FileMigrator 

1.  `canonicalizeAbsolutePath(path)` 
2.  `createdAt`  surviving row
3.  id  id-remap  `file_ref` FileMetadata.id  id  surviving id
4.  FileMetadata.id  `file_entry` 

 invariant  schema  UNIQUE index  migrator —— remap 

**Step C: ** Migrator

|                               |  Migrator                          |                                            |
| ----------------------------------- | -------------------------------------- | ---------------------------------------------- |
| `message_blocks`  `file.id`       | ChatMigrator                           |  id  file_ref.fileEntryIdQ3  |
| `paintings`  `files[].id`         | PaintingMigrator RFC §10.4 |                                            |
| `knowledge_items`  `data.file.id` | KnowledgeMigrator              | `FileItemData.file.id`                 |
| file_ref            | FileMigrator /  Migrator       |  fileEntryId  v4 id                    |

** ID **—— Option A 

#### 2.9.4 

|                                       |                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Renderer  v7          |  grep `FileEntryIdSchema``z.uuidv7()`  fileEntry.ts  v7                 |
| v7 time-ordering  v4 "" |  entry  v7 v4  4v7  7—— createdAt  id |
|  v4                     | `uuidPrimaryKeyOrdered()`  entry  v7 insert API/IPC  FileManager                    |

#### 2.9.5 

**S** schema  + test FileMigrator  id ""

****Schema Step A** PR**FileMigrator Step B Batch 0 FileMigrator 

### 2.10 FileMigrator  migrator 

>  §2.2–§2.9  FileMigrator ** migrator **§2.7  / §2.8 created_at / §2.9 id  / §2.3 file_ref  §2.10.6 

#### 2.10.1 FileMigrator  MigrationEngine 

- ****`src/main/data/migration/v2/migrators/FileMigrator.ts` migrator 
- **idmigrator **`'file'`
- **`BaseMigrator.order`** **`order = 2.7`**—— `AgentsMigrator` (2.5) `KnowledgeMigrator` (3) 
  -  `FileEntry`  migratorKnowledge 3 / Chat 4 /  Painting FileMigrator 
  -  BootConfig / Preferences / Assistant  file  migrator 
- ****
  - `MigrationContext.db` —— SQLite 
  - `MigrationContext.sources.dexieExport.tableExists('files')` / `createStreamReader('files')` ——  v1 Dexie  `files.json`
- ****
  -  `file_entry`  v1 Dexie `files`  external 
  - ** `file_ref` **—— ref  migrator  §2.10.3
  -  `MigrationContext.sharedData`  migrator  §2.10.3

#### 2.10.2 

****v1 internal  `{userData}/Data/Files/{id}{ext}` `FileStorage.ts`  setter  `name: uuid + ext`  v1 `ext` **** `uuid-abc.pdf`v2 `resolvePhysicalPath`  `{userData}/Data/Files/{id}.{ext}`v2 `ext` **** `uuid-abc.pdf`

****v1 / v2 ****FileMigrator  schema  `ext` `'.pdf' → 'pdf'`—— §5.1 "" 

****FileMigrator 

```typescript
//  —  20  internal 
const sample = candidateEntries.filter((e) => e.origin === 'internal').slice(0, 20)
let missing = 0
for (const entry of sample) {
  if (!(await pathExists(resolvePhysicalPath(entry)))) missing++
}
if (sample.length > 0 && missing / sample.length > 0.5) {
  throw new MigrationFatalError(
    `Physical file naming assumption violated: ${missing}/${sample.length} sampled internal files not found at {id}.{ext}; aborting before mass orphan`
  )
}
```

 > 50% —— v1  `{id}_${origin_name}` "DB " entry

< 50% `recordWarning` v1 

#### 2.10.3  migrator file_ref 

`file_ref` ** FileMigrator ** migrator " → " migrator  FileMigrator 

****

| v1                            |  migrator                | sourceType         | role           |                                                                        |
| --------------------------------------- | ---------------------------- | ------------------ | -------------- | ------------------------------------------------------------------------------ |
| `message_blocks.file.id`FILE block  | ChatMigrator****     | `'chat_message'`   | `'attachment'` |  chat PR #15067  defer PR  `'chat_message'`  `FileRefSourceType` union +  `createRefSchema` variant +  `SourceTypeChecker` `'chat_message'`  unionOrphanRefScanner v1 `block.file.id`  v2 `ImageBlock.fileId` / `FileBlock.fileId`inline JSON |
| `message_blocks.file.id`IMAGE block | ChatMigrator****     | `'chat_message'`   | `'image'`      |                                                                            |
| Redux `paintings[].files[].id`          | PaintingMigrator**** | `'painting'`       | `'asset'`      | painting  PR  `'painting'`  `FileRefSourceType` union +  `createRefSchema` variant +  `SourceTypeChecker` `'painting'`  unionOrphanRefScanner  §2.3.9 / §6 Q7 |
| `knowledge_items.data.file.id`          | KnowledgeMigrator            | `'knowledge_item'` | `'source'`     |  knowledge_item  §6 Q9  `loadFileLookup`   |
| AI provider upload cache                |  FileUploadService | —                  | —              | `purpose`  §2.2                                        |

**MigrationContext  migrator **

FileMigrator  `ctx.sharedData` 

```typescript
//  — FileMigrator.run 
ctx.sharedData.set('fileMigrator.idRemap', /* ReadonlyMap<oldId, FileEntryId> */)
ctx.sharedData.set('fileMigrator.knownIds', /* ReadonlySet<FileEntryId> */)
```

- **`idRemap`**  external ——`canonicalizeAbsolutePath`  loser id  surviving idinternal ****
- **`knownIds`**  `file_entry`  id  migrator  " fileId "

 migrator  file ** DB** fileEntryService 

** migrator **

```typescript
//  — ChatMigrator  message_block 
const idRemap = ctx.sharedData.get('fileMigrator.idRemap') as ReadonlyMap<string, FileEntryId>
const knownIds = ctx.sharedData.get('fileMigrator.knownIds') as ReadonlySet<FileEntryId>

async function migrateOneMessageBlock(block) {
  if (block.file?.id) {
    const fileEntryId = idRemap.get(block.file.id) ?? (block.file.id as FileEntryId)
    if (!knownIds.has(fileEntryId)) {
      // FileMigrator  id ——  ref
      this.recordWarning(`message_block ${block.id}: file ${block.file.id} missing in file_entry; ref skipped`)
      return
    }
    await ctx.db
      .insert(fileRef)
      .values({
        fileEntryId,
        sourceType: 'chat_message',
        sourceId: block.id,
        role: block.type === 'IMAGE' ? 'image' : 'attachment'
      })
      .onConflictDoNothing() // 
  }
  // ...  message_block ...
}
```

****

1. ** migrator  fileEntryId  `idRemap`**—— surviving id internal  miss  id v4external  loser id
2. **`fileRefService.create` `db.insert(fileRef)` `onConflictDoNothing` **—— `UNIQUE(fileEntryId, sourceType, sourceId, role)` 
3. ** ref  → `recordWarning` **v1 `count`  ref  `OrphanRefScanner` —— ref  `file_entry` "" cleanup UI 
4. **`fileEntryId`  `knownIds` FileMigrator → `recordWarning`  ref**" ref  entry" FK 

#### 2.10.4 FileMigrator 

|                                                                   |                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `dexieExport.tableExists('files')`  false                             | `recordWarning` FileMigrator  file_entry migrator  file id  `knownIds` miss → warn-skip ref |
|  file `origin_name` undefined                           | `recordWarning` + skip                                                                                  |
| `canonicalizeAbsolutePath`  null byte                           | **** `MigrationFatalError` ——v1                                        |
| External  surviving                                         |  `MigrationFatalError`                                                                                            |
| `file_entry` INSERT  schema CHECKorigin/size/externalPath |  `MigrationFatalError` ——mapping  bug                                                                      |
| §2.10.2  > 50%                                              |  `MigrationFatalError`                                                                            |
|  file_entry                                             | FileMigrator  `file_entry`                                                  |

****FileMigrator  `file_entry` ** DB ** =  = "" migrator  `knownIds`

 migrator  `file_ref` **** FileMigrator —— migrator  §2.10.3  `idRemap` / `knownIds` 

#### 2.10.5 

FileMigrator  `info`- `loggerService.withContext('FileMigrator')`

```typescript
//  — FileMigrator.run 
{
  event: 'file-migrator-completed',
  v1FilesScanned: number,            //  file 
  v1FilesSkippedMalformed: number,   //  / canonicalize  
  v1FilesMerged: number,             // external  loser 
  fileEntriesInserted: number,       //  file_entry = scanned - skipped - merged
  sampleVerifyMissing: number,       // §2.10.2 > 50%  fatal
  durationMs: number,
}
```

 migrator  `*-file-refs-built` 

```typescript
{
  event: 'chat-migrator-file-refs-built' | 'knowledge-migrator-file-refs-built' | ...,
  refsInserted: number,
  refsSkippedMissingEntry: number,   // knownIds miss
  refsSkippedConflict: number,       // onConflictDoNothing 
}
```

 file 

#### 2.10.6  §2 

| §2              |  FileMigrator                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| §2.2 `purpose`            |  file_entry file_upload deferred                                            |
| §2.3 `count`              | file_ref  migrator §2.10.3                                                          |
| §2.4 `tokens`             |                                                                                           |
| §2.5 `type`               | v2  ext                                                                           |
| §2.6 `path`               |  `origin``isInternalPath(path)` → internal external + canonicalize  `externalPath`|
| §2.7 `name / origin_name` | `name` ← origin_name  ext`ext` ← "" name                                   |
| §2.8 `created_at`         | ISO → ms epoch`updatedAt` v1  updatedAt                                                         |
| §2.9 `id`                 |  v4 id                                                                    |

#### 2.10.7 

|        |                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------- |
|  | 1 FileMigrator.ts+ MigrationContext  + ~3  migrator  file_ref |
|    | " Dexie →  →  →  INSERT" +  migrator  file_ref            |
|  | External  surviving  + idRemap  migrator                                        |
| **** | **M**                                                                                             |

** / PR **

1. §2.9.3 Step A —— `FileEntryIdSchema`  `z.uuid()` PR
2. `MigrationContext.sharedData`  `fileMigrator.idRemap` / `fileMigrator.knownIds`  key  `getFileMigratorProducts(ctx)` helper  migrator  cast `unknown`
3. FileMigrator  §2.10.2  + §2.10.3 idRemap  + §2.10.4  + §2.10.5 
4. KnowledgeMigrator  §6 Q9  `data.file.id`  file_ref `loadFileLookup`  Q9 
5. ChatMigrator ****PR #15067  defer chat  file_ref  PR ——`allSourceTypes`  `'chat_message'``createRefSchema` `OrphanRefScanner` checker
6. PaintingMigrator  painting **** v2 

---

## 3. 

>  [`filemetadata-consumer-audit.md §6`](./filemetadata-consumer-audit.md)****

### 3.1 

|     |                                    |  |                                 |  PR  |
| ------- | ------------------------------------ | ------ | ----------------------------------- | ---------- |
| Batch A | Translate / Agent workspace / Export | S      | §2.6 path             | 1-2        |
| Batch B | Paste /  / OCR               | M      | §2.6 path                           | 2-3        |
| Batch C | Painting                             | L      | §2.3 count                          | 2-3        |
| Batch D | Knowledge                            | L      | §2.3 count + KnowledgeMigrator  | 2-4        |
| Batch E | Messagesattachments / images     | XL     |                   | 3-5        |

****

- 
- Messages ——
- 

### 3.2 

 PR 

1. **** UI  component
2. **** FileMetadatahashmap
3. ** API ** `window.api.file.*` 
4. ** API ** v2  IPC / DataApi
5. **** Dexie → SQLite  Migrator 
6. **UI / ** dangling 
7. ****
8. ****

### 3.3 Batch A-E 

—— Batch  §3.2 

### 3.4 

> **§2 Batch A-E §3.1** consumer phasing 

#### 3.4.1 Backup / Restore  v2 file 

**v1 **

- `src/main/services/BackupManager.ts`  `fs-extra.copy`  `userData` 
- `Data/Files/*`+ Dexie  `files.json`+ LocalStorage / Redux state 
- S3 / WebDAV  zip 

**v2 **

- Dexie `files`  Cleanup Batch SQLite `file_entry` / `file_ref` 
- + SQLite DB  +  Dexie 
- **** + SQLite DB
  -  + DB  →  orphan-file-sweep  §10.4  `count-fraction` 
  - DB  +  → `file_entry`  dangling

****

| #   |                                                   |                                                                                                                                                                           |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `src/main/services/BackupManager.ts`                  |  Dexie dump SQLite DB v2  file_entry / file_ref  DB `<backup>/sqlite/<db-name>.db` `DbService.checkpoint()`  WAL flush  copy |
| B2  | BackupManager                                 |  SQLite DB  backup  sqlite  atomically rename **DbService **                                            |
| B3  | BackupManager                                 |  backup  v1 sqlite  v2 sqlite v1 backup  v2  Dexie  FileMigrator                                   |
| B4  | `FileManager.runStartupSweeps` / `OrphanRefScanner`   |  backup restore** orphan sweep **—— DB ↔ FS  BackupManager  restore  setFileManager onInit  |
| B5  | Backup  v2 marker                               | `<backup>/manifest.json`  `formatVersion: 2`v1 BackupManager  v2 marker                                                                         |

****

|                                                   |                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
|  v1 backup  sqlite  v2          |  FileMigrator Dexie `files.json`  backup  input                                                       |
| Backup  backup  DB  |  `DbService.checkpoint()` +  v1  backup window                   |
| Restore                         |  staging  rename  staging                           |
| v2 backup  v1                       | v2 marker  v2 marker  v1                                                                           |

******L** main BackupManager + DbService + FileManager

**** Phase 2 ——FileMigrator  BackupManager** Cleanup Batch** Phase 2  SQLite 

#### 3.4.2 OrphanRefScanner  gate

****

- RFC §6.4  OrphanRefScanner  `Background` phase  `file_ref`  sourceId 
- FileManager  `runStartupSweeps` file-sweep + orphan-entry-report `onInit`  fire-and-forget
-  MigrationEngine FileMigrator  file_entry →  migrator  file_refscanner file_entry  file_ref—— RFC §7.1 preserve entry `orphan-ref-cleanup` —— §3.4.1 B4  backup-restore  gate

****

| #   |                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------- |
| O1  | `MigrationEngine`  migrators migrator  file_ref  `ctx.sharedData`  `'migration.completed': true`  lifecycle `Signal<void>` |
| O2  | `OrphanRefScanner.start()`  `FileManager.runStartupSweeps()`  await  Signal polling sharedData  Signal |
| O3  | DB  migrate OrphanRefScanner ****—— PaintingMigrator Phase 2  `firstRunAfterMigration`  |
| O4  | OrphanRefScanner  migration / restore  best-effort                       |

******S**Signal  +  await + flag bookkeeping

**** FileMigrator  PR—— v2  file_ref  entry  zero-ref §7.1  internalpolicy matrix  external 0-ref §7.2 deferred 

#### 3.4.3 Dexie `files`  phasing

****§5.1  Dexie  Cleanup Batch——Phase 2  renderer  Dexie `files`  §4 shim 

**phasing **

|                   | Dexie `files`                                                             |                                                        |                                                                                        |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Phase 1**           | renderer                                                           | `FileManager.addFile` / `uploadFile`                         | `db.files.where(...)`                                                                      |
| **Phase 2 **      | **Frozen**                                                |  v2 `createInternalEntry` / `ensureExternalEntry` | Batch A  `toFileMetadata`  v2 `FileEntry`  Dexie  P          |
| **Phase 2 **    |                                                                             |                                                            |  Batch  `FileEntry``toFileMetadata`                               |
| **Cleanup Batch**   | Dexie v12 upgrade                                                     | n/a                                                            | n/a                                                                                            |

****

| #   |                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Phase 2  PRrenderer  `db.files.put` / `add` / `update` / `delete`  `DexieFilesFrozenError` `db.files.get` / `toArray` / `where`  `toFileMetadata`  |
| D2  | `useFiles` /  `FileManager.uploadFile`  v2 IPC `FileEntry`**** Dexie                                                     |
| D3  | Cleanup Batch PRDexie schema v12  `files`  +  `toFileMetadata` shim  `FileMetadata`                                          |

****

- ****——Phase 2  freeze Dexie ↔ SQLite  shim 
- shim FileEntry →  FileMetadata  §4.1 §3.4.3  §4.1 

******M**renderer  + DexieFilesFrozenError 

****Phase 2  Batch A  prerequisite PR

#### 3.4.4 v1 `window.api.file.*` preload API 

****v1 preload  49  file  API`File_Read` / `File_Write` / `File_Upload` / `File_Delete` / `onFileChange`  ...§4.3  Cleanup Batch  `FileMetadata`  `FileStorage`** preload API **——49  channel  Cleanup Batch 

****

|                                                                                                               |                                                                                   |                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ** v2 IPC **                                                                                            | `read` / `write` / `writeWithId` / `delete` / `rename` / `move` / `save` / `open` / `showInFolder` / `binaryImage` / `base64Image` / `base64File` / `pdfInfo` / `isTextFile` / `isDirectory` |  Batch  deprecateCleanup Batch  preload entry + main  handler |
| ** v2 **                                                                                        | `readExternal` / `saveBase64Image` / `savePastedImage` / `download` / `copy`        | Batch C-E  `read({encoding})` / `getMetadata` / `createInternalEntry({source:'url'})`Cleanup Batch  |
| ****v2                                                                                 | `select` / `selectFolder`Electron dialog/ `openPath` / `getPathForFile`         | —— Electron  file                |
| **watcher **                                                                                                  | `startFileWatcher` / `stopFileWatcher` / `pauseFileWatcher` / `resumeFileWatcher` / `onFileChange` |  `createDirectoryWatcher` +  IPC  §3.4.5   |
| ****                                                                                                      | `clear` / `mkdir` / `validateNotesDirectory` / `getDirectoryStructure` / `batchUploadMarkdown` / `checkFileName` |  Notes / Knowledge  module  IPC `window.api.file.*` |

****

-  Batch  deprecate  v1 APIpreload  `@deprecated` JSDoc +  `console.warn` 
- Cleanup Batch PR  `delete` preload  +  IPC handler 

******M**49  API  audit

**** Batch  deprecateCleanup Batch 

#### 3.4.5 `remotefile/*` services 

**v1 **

- `src/main/services/remotefile/{Gemini,OpenAI,Mistral}Service.ts`  `BaseFileService` `uploadFile` / `retrieveFile` / `listFiles` / `deleteFile`
- chat  `window.api.fileService.upload(provider, file)`  services
- `fileProcessor.ts`  cached `fileId`

**v2 **

- `FileUploadService` + `file_upload` RFC §9.8 Phase X Vercel AI SDK 
- chat  `FileUploadService.ensureUploaded(entryId, provider)`cache  `file_upload` 

****

|                                 | chat                                                                                                   |                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Phase 1 / Phase 2 **          | `remotefile/*` services `fileProcessor.ts`  v2 `FileEntry`  `entryDisplayName(entry)`  displayName§2.7 D6 | `FileEntry`v2 `BaseFileService` API                |
| **Phase 2 Batch BAI Core**      | `fileProcessor.ts` / `messageConverter.ts`  v2 API**`remotefile/*` services **                  |                                                                 |
| **Phase XFileUploadService **| `FileUploadService.ensureUploaded` `remotefile/*` services  `@deprecated`                            | `FileEntry` + `file_upload` cache                                  |
| **Phase X+1**               | `remotefile/*` services                                                                                   | n/a                                                                 |

****

- Phase 2 **** FileUploadService——`remotefile/*` services  upload  displayName / purpose  v2 schema §2.2 / §2.7 
-  cache `fileProcessor.ts`  cache  renderer —— `file_upload`  Vercel AI SDK 
- watcher §3.4.4 watcher  `createDirectoryWatcher`  IPC channel `<module>-event` `notes-event` renderer `file-manager-event` —— FileManager 

******S** §2.2 / §2.7 

****Batch B Phase X 

#### 3.4.6 §3.4 

|   |                        |  |  Phase                             |  PR                          |
| ----- | -------------------------- | ------ | ----------------------------------------- | -------------------------------- |
| 3.4.1 | Backup / Restore       | 🔴   | Phase 2  Cleanup Batch            |  FileMigrator        |
| 3.4.2 | OrphanRefScanner gate      | 🔴   |  FileMigrator  PR                     |  FileMigrator PR              |
| 3.4.3 | Dexie `files`  phasing   | 🟡   | Phase 2  prerequisite                  | Batch A                      |
| 3.4.4 | preload API            | 🟢   |  Batch deprecateCleanup Batch           |  + Cleanup Batch PR        |
| 3.4.5 | `remotefile/*`       | 🟢   | Batch B Phase X               | Batch B+ Phase X+1|

---

## 4. Shim

> **Scope **shim ** P**—— `FileEntry` Dexie / message_block  / knowledge_item JSON" `FileMetadata`"
>
> ** shim**
>
> - ** I  shim**——`FileMetadata → FileInfo` 
> - ** A  shim**—— `createInternalEntry` / `ensureExternalEntry`  `FileInfo` shim  A 
> - ** shimFileMetadata → FileEntry**——`FileInfo → FileEntry`  FileManager sanctioned brand  `FileEntry`  Zod 

### 4.1 `toFileMetadata(entry: FileEntry, physicalPath: FilePath): FileMetadata` ——  P 

```typescript
//  P 
function toFileMetadata(entry: FileEntry, physicalPath: FilePath): FileMetadata {
  return {
    id: entry.id,
    name: entry.ext ? `${entry.id}.${entry.ext}` : entry.id, // ""
    origin_name: entry.ext ? `${entry.name}.${entry.ext}` : entry.name,
    path: physicalPath, // via FileManager.resolveForSystem / resolvePhysicalPath
    size: entry.size,
    ext: entry.ext ? `.${entry.ext}` : "", // 
    type: getFileTypeFromExt(entry.ext), // ops.getFileType
    created_at: new Date(entry.createdAt).toISOString(),
    count: 0, //  file_ref
    // tokens / purpose ——
  }
}
```

****

- `ext` 
- `count`  `file_ref` 0
- `path`  main  `resolvePhysicalPath(entry)` renderer 

### 4.2  shim****

>  `FileMetadata`  `FileEntry`——`FileEntrySchema`  Zod brand 
>
> -  `FileMetadata` **Dexie ** FileMigrator  `file_entry` §6
> -  `FileMetadata` **runtime ** `FileStorage.uploadFile` Phase 2  producer  `createInternalEntry` IPC
> - ****OCR / TokenService /  I  A ——`FileMetadata`  `FileInfo`

### 4.3 Shim 

- Phase 2  `toFileMetadata` P 
- Batch A-E consumer migration  P  `FileEntry`shim 
- Cleanup Batch** `toFileMetadata`**  `FileMetadata` `FileInfo` / `FileEntry` / `FileHandle` 

---

## 5. 

### 5.1 

- **** internal  `{userData}/files/{id}.{ext}`FileMigrator 
- **** Dexie  Cleanup Batch
- **** PR 

### 5.2 tentative

|  |                                                                   |                             |
| ------ | --------------------------------------------------------------------- | ------------------------------- |
| M1     | §2.2 purpose  PR                                              |  §2.2                 |
| M2     | Shim §4                                               | FileEntry schema  |
| M3     | §2.3-§2.9                                       |  PR             |
| M4     | Batch A                                                           | M2 + §2.6 path                  |
| M5     | Batch B-D                                                         | M4                              |
| M6     | Batch E                                                           | M5 +                |
| M7     | Cleanup Dexie `files`  / `FileStorage.ts` / `FileMetadata`  | M6                              |

### 5.3  PR 

 PR 

- ** / **
- ****
- ****
- ****

---

## 6. 

| #   |                                                                              |                                                   |             |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- |
| 1   | `id` v4 → v7  ID                                                     |                                               | §2.9            |
| 2   | `path`  renderer-side " + "                      |                                                   | §2.6  |
| 3   | Shim  renderer  main                                                   |  main                               | §4              |
| 4   | Phase 2                                                            |                                                   |     |
| 5   |  ref vs v2  2                        |                                               | §2.3.10         |
| 6   | FilesPage  ref_count                                       |                                 | §2.3.11         |
| 7   | PaintingMigrator  painting                                 | `'painting'`  `FileRefSourceType` union OrphanRefScanner PaintingMigrator  PR union tuple + schema + checker | §2.3.9 Step A   |
| 8   | `FilesPage.handleDelete` " +  block" renderer  |                                                   | §2.3.9 B7       |
| 9   | FileMigrator `KnowledgeMigrator.loadFileLookup` stream-read v1 `files.json`  lookup `ctx.sharedData['fileMigrator.knownIds']`  |  | §2.10.3 / §2.10.7 Step 4 |

---

##  A

|                 |                                        |                |
| --------------------- | -------------------------------------------- | ------------------ |
| `FileMetadata`        | `FileEntry` + `FileRef` +            |  §2      |
| `FileStorage.ts`      | `FileManager.ts` + `ops/*` + `DanglingCache` |            |
| `window.api.file.*`   | `window.api.fileIpc.*` + DataApi `/files/*`  |  RFC §9    |
| `Dexie.files`       | SQLite `file_entry`  + `file_ref`        |  RFC §10 |
| `file.count`  | `file_ref`                           | §2.3               |
| `file.path`   | `FileHandle` +  resolve                | §2.6               |

##  B

|        |  |                                                    |
| ---------- | ---- | ------------------------------------------------------ |
| 2026-04-19 | 0.1  |  RFC §10.6  +  |
| 2026-05-11 | 0.2  |  §2.10 FileMigrator  migrator /order`idRemap`/`knownIds`  migrator  §2.x §6  Q9KnowledgeMigrator `loadFileLookup`  |
| 2026-05-11 | 0.3  |  §3.4 Backup-Restore  / OrphanRefScanner  gate / Dexie `files`  phasing / v1 `window.api.file.*`  / `remotefile/*` services  RFC §13  |
