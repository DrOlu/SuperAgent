# FileMetadata 

> **⚠️  OUTDATED2026-04-21**
>
>  v1 `FileMetadata` / `FileStorage` """"
>
> ""`FileIpcApi.createEntry({origin:...,content:...})` 
>
> - `createEntry({origin:'internal',...})` → `createInternalEntry(...)`
> - `createEntry({origin:'external',...})` → `ensureExternalEntry(...)` upsert by path
> - External entry  trash `permanentDelete`  external  DB 
> - **** `FileMetadata` "DB """v2  `FileEntry` `FileInfo` `FileHandle` " /  / " P/I/A ——§6 
> - **ID **Batch 0 "v1 v4 id  v2 v7""id " migration-plan §2.9 ——v1 id v4**** v2 `file_entry.id`schema  `z.uuid()` message_blocks / paintings / knowledge_item / file_ref
>
> ** IPC **[`docs/references/file/architecture.md`](../../../docs/references/file/architecture.md)[`rfc-file-manager.md`](./rfc-file-manager.md)[`file-arch-problems-response.md`](./file-arch-problems-response.md)

---

## P / I / A

v2 

|  |                                                      |                                                 |
| -- | ------------------------------------------------------------ | ------------------------------------------------------- |
| **P**  |  FileMetadata  Dexie / message_block / knowledge_item  DB  | **→ FileEntry** `FileEntryId`                     |
| **I**  |  path / name / size / ext / type  | **→ FileInfo** shim               |
| **A**    |  pass-through"" | **→ ** FileManager  FileInfo |

§6 "****" [`migration-plan.md §1.2`](./migration-plan.md#12-filemetadata-)

---

> ****: 2026-04-19
> ****:  `FileMetadata`  `FileStorage` IPC Dexie `files`  renderer / main / shared 
>
> **** `fs`  [`fs-usage-audit.md`](./fs-usage-audit.md)v2  `FileEntry / FileRef / FileHandle` 
>
> ****
>
> - [`docs/zh/references/file/architecture.md`](../../../docs/zh/references/file/architecture.md) — v2 
> - [`docs/zh/references/file/file-manager-architecture.md`](../../../docs/zh/references/file/file-manager-architecture.md) — FileManager 
> - [`ipc-redesign.md`](./ipc-redesign.md) — v2 IPC 
> - [`handler-mapping.md`](./handler-mapping.md) — v1 IPC → v2 IPC 

---

## 1. Executive Summary

### 1.1 

|                              |                                                                 |
| -------------------------------- | ------------------------------------------------------------------- |
|  `FileMetadata`    | **96 **                                                           |
|                        | **391 **                                                          |
|  `window.api.file.*`   | **66 **151                                              |
|  `FileStorage`  IPC  | **~47 **`File_*`  + 4 `FileService_*`               |
|  preload  `file.*` API     | **47 **                                                       |
|  Dexie `files`       | **9 ** `db.files.*`  `db.message_blocks.where('file.id')` |

### 1.2 

1. **`FileMetadata` "" 8+ **  `{id, name, origin_name, path, size, ext, type, created_at, count, tokens?, purpose?}` OCR AI SDK FilePart /" shape" `FileMetadata`  schema `ImageMessageBlock.file``KnowledgeFileItem.content``PaintingsState.files``VideoUploadResult.{videoFile,srtFile}`**/** `FileEntry`  renderer ""token  UI 

2. **" `path` "**  renderer  `file.path` `getSafePath``AttachmentPreview``PasteService``TranslatePage`OCR`utils/file.ts:isSupportedFile`MCP agent  v2 `FileEntry` ** `path`**internal  id+ext  `services/FileManager.ts:getFilePath`external  `externalPath`renderer  `cacheService.get('app.path.files')`  path v2 ""

3. **`count` v2  `file_ref` **  `FileManager.addFile/deleteFile`  `count` →count++delete force=false→count--Dexie  `files`  `count` v2  `file_ref`  (sourceType, sourceId, role) ****"" `store/knowledge.ts:46``handleDelete``cleanupMultipleBlocks``PaintingsState` Phase 1 

4. ** `FileStorage` IPC ""**2043 47+  CRUD`upload/delete/read/copy` CRUD`deleteExternalFile/readExternal/moveDir``saveBase64Image/savePastedImage/download``pdfPageCount/isTextFile/isDirectory``open/save/selectFolder`ripgrep-based `listDirectory``getDirectoryStructure`chokidar watcher6 Notes `fileNameGuard/validateNotesDirectory/batchUploadMarkdown/renameDir` URL `base64Image/binaryImage/base64File`v2  `FileIpcApi`  18  + `FileHandle`  `ops/*` `handler-mapping.md`

5. **Knowledge  migrator** `src/main/data/migration/v2/migrators/KnowledgeMigrator.ts` + `mappings/KnowledgeMappings.ts`  Dexie `files`  `KnowledgeItemData.file`  `FileMetadata`  `FileItemData.file`  schema **message/painting/translate/notes ** `KnowledgeItemData.file`  `FileMetadataSchema``src/shared/data/types/knowledge.ts:42`**v2  SQLite  FileMetadata **——"migrator-only "

### 1.3 

|                  |                                                                                                                                 |                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Phase 1**          |  FileEntry/FileManager/FileRef/IPC `src/main/file/**``src/shared/file/types/**` FileStorage            |  PR #13451                             |
| **Batch 0**          | Dexie `files`  +  `FileStorage`  shimrenderer  `services/FileManager.ts`                            |                                |
| **Batch A-E**        | **Messages ** Knowledge migrator Painting Translate/Paste/Video |  `FileMetadata`  UI  |
| **Cleanup Batch**    |  Dexie `files` `FileStorage.ts``services/FileManager.ts` `FileMetadata` OCR/remotefile              |                                    |

---

## 2. FileMetadata 

 `FileMetadata` `src/shared/data/types/file/file.ts:17`  `src/renderer/types/file.ts:83`

```ts
interface FileMetadata {
  id: string; // uuidv4renderer  or main  uploadFile 
  name: string; //  id + ext
  origin_name: string; // /
  path: string; //  {userData}/files/{id}{ext}
  size: number; // bytes
  ext: string; // '.pdf'
  type: FileType; // 'image'|'video'|'audio'|'text'|'document'|'other'
  created_at: string; // ISO 8601
  count: number; //  GC 
  tokens?: number; //  token
  purpose?: OpenAI.FilePurpose; // OpenAI  purpose
}
```

|           |                                                                                        | v2                                                                                            |                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`          |  keyDexie pkIPC FileRef                                                      | `FileEntry.id` (UUID v7)                                                                          | **XL**v7  v4  rewrite migratorID  message blockpainting files     |
| `name`        | =`id+ext` `{storageDir}/{name}`                                                    |  id+ext                                                                     | **M**                                                                   |
| `origin_name` | UI token servicemessage block                                    | `FileEntry.name` + `FileEntry.ext`                                                    | **L** UI  `FileManager.formatFileName`            |
| `path`        | OCRSupportExts AttachmentPreviewPasteServiceTranslatePageMCP tool                  | internal`FileManager.getFilePath`external`entry.externalPath`                               | **XL** shim  "resolve(handle) → absPath"                          |
| `size`        | UI aiCore `convertFileBlockToFilePart`knowledge ingestionFilesPage | `FileEntry.size`internal external                                                   | **S**                                                                                   |
| `ext`         | FILE_TYPE MIME path                                            | `FileEntry.ext`****                                                     | **M** `file.ext === '.pdf'`  `file.ext === 'pdf'`                           |
| `type`        | UI FilesPage  vs OCR FILE_TYPE.TEXT/IMAGE            | ** FileEntry** `PhysicalFileMetadata.type`kind=file  `getMetadata`  | **L**type """"UI  JOIN                    |
| `created_at`  | UI formatFileNameDexie                                                               | `FileEntry.createdAt`ms epoch int ISO string                                              | **S**/                                                                    |
| `count`       | FileManagerstore/knowledge                                                         | `file_ref`                                                                                  | **L**handleDelete  messageBlocks.where('file.id') |
| `tokens?`     | TokenService attachment  tokens                                                        |  featuretoken cache                                                 | **S**                                                                       |
| `purpose?`    | OpenAI/qwen-long  purpose`fileProcessor.ts:130`                                          | Phase 1  file_upload `file.ts:7-9`                                        | **S**                                                                                   |

****

- `ImageFileMetadata = FileMetadata & { type: 'image' }` —  `types/file.ts:130` OCR `SupportedOcrFile``TesseractService``SystemOcrService``PpocrService``OvOcrService``MistralPreprocessProvider` 
- `PdfFileMetadata = FileMetadata & { ext: '.pdf' }` —  `types/file.ts:134`**** §8 
- `isImageFileMetadata(file): file is ImageFileMetadata` — OCR + paintings 

---

## 3. 

### 3.1 4 

|                                          |                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/shared/data/types/file/file.ts:17` | shared "need be refactored" index.ts  `export *`           |
| `src/renderer/types/file.ts:83`          | renderer                                                           |
| `src/shared/data/types/knowledge.ts:42` | **v2 Schema **`FileMetadataSchema: z.ZodType<FileMetadata>`  `FileItemData`  |
| `src/shared/file/types/common.ts`       |  `PhysicalFileMetadata`  `FileMetadata`  stat              |

`renderer/types/file.ts`  `ImageFileMetadata``PdfFileMetadata``isImageFileMetadata`

### 3.2 Renderer Services8 

|                                                      |                                 |  FileMetadata                                                           |
| -------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `src/renderer/services/FileManager.ts`               | ****18    | Dexie CRUD + IPC  renderer  FileMetadata              |
| `src/renderer/services/FileAction.ts`                | FilesPage  delete/rename/sort     | `handleDelete`  `db.message_blocks.where('file.id')`  topics.messages |
| `src/renderer/services/MessagesService.ts`           |  FileBlock/ImageBlock |  `FileMessageBlock.file`  `ImageMessageBlock.file`                      |
| `src/renderer/services/KnowledgeService.ts`          |  file       |  `KnowledgeSearchResult & { file: FileMetadata \| null }`                 |
| `src/renderer/services/TokenService.ts`              |  tokens                     |  file `file.tokens`                                                   |
| `src/renderer/services/PasteService.ts`              |  → FileMetadata       |  `file.createTempFile+get`                                            |
| `src/renderer/services/db/DexieMessageDataSource.ts` |  DB                     |  `db.files.get/update/delete`                               |
| `src/renderer/services/import/utils/database.ts`     |  files            | Dexie  schema                                                           |

### 3.3 Renderer Hooks5 

|                                            |                                                      |
| ---------------------------------------------- | -------------------------------------------------------- |
| `src/renderer/hooks/useFiles.ts`           | Electron dialogstate  `FileMetadata[]` |
| `src/renderer/hooks/useKnowledgeFiles.tsx` |  `KnowledgeBase.items`  file                   |
| `src/renderer/hooks/useKnowledge.ts`       |  delete`window.api.file.delete(file.name)`     |
| `src/renderer/hooks/useTopic.ts`           |  topic messages  files                 |
| `src/renderer/hooks/useOcr.ts`             | OCR `ImageFileMetadata`                          |

### 3.4 Renderer Pages

**Chat / Home8 **

- `src/renderer/pages/home/Inputbar/Inputbar.tsx` —  `files: FileMetadata[]` state
- `src/renderer/pages/home/Inputbar/AttachmentPreview.tsx` —  UI7 
- `src/renderer/pages/home/Inputbar/components/InputbarCore.tsx` — 
- `src/renderer/pages/home/Inputbar/context/InputbarToolsProvider.tsx` — Provider5 
- `src/renderer/pages/home/Inputbar/hooks/usePasteHandler.ts` / `useFileDragDrop.ts` — paste/drag 
- `src/renderer/pages/home/Inputbar/tools/components/AttachmentButton.tsx` / `useMentionModelsPanel.tsx` / `MentionModelsButton.tsx` — 
- `src/renderer/pages/home/Messages/MessageEditor.tsx` —  files

**Knowledge8 **

- `src/renderer/pages/knowledge/items/KnowledgeFiles.tsx:93,124` —  ingestion 
- `src/renderer/pages/knowledge/components/KnowledgeSearchPopup.tsx` — 
- `src/renderer/pages/knowledge/components/KnowledgeSearchItem/{index,TextItem,VideoItem,components}.tsx` —  `{...item, file: FileMetadata|null}`

**Files3 **

- `src/renderer/pages/files/FilesPage.tsx:50` — `useLiveQuery<FileMetadata[]>`
- `src/renderer/pages/files/FileList.tsx` / `ContentView.tsx` — 

**Paintings7 **

- `DmxapiPage.tsx``PpioPage.tsx``AihubmixPage.tsx``OvmsPage.tsx``NewApiPage.tsx``SiliconPage.tsx``ZhipuPage.tsx` provider 
- `components/ImageUploader.tsx` — 

**Translate1 **

- `src/renderer/pages/translate/TranslatePage.tsx:24` — 6 

**Agents1 **

- `src/renderer/pages/agents/components/AgentSessionInputbar.tsx` — 

### 3.5 Renderer Store & Utils11 

|                                                               |                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/renderer/store/thunk/messageThunk.ts:34,602,1764`        |  thunk block                            |
| `src/renderer/store/thunk/knowledgeThunk.ts:60,101`           |  thunkaddFiles, addVideo                            |
| `src/renderer/store/knowledge.ts:46`                          | knowledge slice  `FileManager.deleteFiles`        |
| `src/renderer/types/{index,file,newMessage,knowledge,ocr}.ts` |                                                         |
| `src/renderer/utils/{file,knowledge,input}.ts`                |                                                       |
| `src/renderer/utils/messageUtils/{create,find}.ts`            | /                                               |
| `src/renderer/aiCore/prepareParams/fileProcessor.ts`          | **** FileMetadata  FilePart/TextPart/ |
| `src/renderer/databases/index.ts:34,45-136`                   | Dexie Schema`files: EntityTable<FileMetadata, 'id'>`      |

### 3.6 Main Process17 

|                                                                   |                                                         |    |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| `src/main/services/FileStorage.ts`                                    |  IPC                                              | 11         |
| `src/main/services/KnowledgeService.ts`                               | Knowledge ingestion  orchestrator                         | 6          |
| `src/main/services/remotefile/{Base,OpenAI,Gemini,Mistral}Service.ts` |                                               | 2×4=8      |
| `src/main/services/ocr/builtin/{Tesseract,Ov,System,Pp}Service.ts`    | OCR                                                     | 4×4=16     |
| `src/main/services/knowledge/readers/KnowledgeFileReader.ts`          | Knowledge  reader                                       | 2          |
| `src/main/services/knowledge/utils/directory.ts`                      | Knowledge                                           | 3          |
| `src/main/knowledge/preprocess/*.ts` (10  Provider)                 | OCR/preprocess providers                                    | 41 |
| `src/main/knowledge/embedjs/loader/index.ts`                          | embed loader                                                | 3          |
| `src/main/utils/file.ts:123-157,260`                                  | `getAllFiles``base64Image`                  | 4          |
| `src/main/utils/ocr.ts`                                               | OCR                                                 | 2          |
| `src/main/ipc.ts:2,34`                                                | preload  import`FileMetadata``FileMetadata[]`     | 2          |
| `src/main/file/FileManager.ts`                                        | ** FileManager import** | 2          |

### 3.7 Migration2 

|                                                                                 |                                                               |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/main/data/migration/v2/migrators/KnowledgeMigrator.ts:6,337-355`               |  Dexie `files`  FileMetadata                            |
| `src/main/data/migration/v2/migrators/mappings/KnowledgeMappings.ts:4,30,35,91,148` | legacy → new schema  `hasCompleteFileMetadata`  |

---

## 4.  API 

### 4.1 `src/main/services/FileStorage.ts` 47  public IPC

|                                                                         |                                            |                                                                                                                                                              |                                        | v2                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `getFileType(filePath)`                                                     | `FileType`                                     | +                                                                                                                                                          |                                    | `FileIpcApi.getMetadata().type`                                                            |
| `selectFile(_, options?)` → `File_Select`                                   | `FileMetadata[] \| null`                       |                                                                                                                                                                | Electron dialog +  meta                | `FileIpcApi.select(options)` → `string[]`                                            |
| `uploadFile(_, file)` → `File_Upload`                                       | `FileMetadata`                                 | chat attachknowledge ingestionpaintings                                                                                                                    | + `{userData}/files/`            | `FileIpcApi.createEntry({origin:'internal',content:FilePath})`                             |
| `getFile(_, filePath)` → `File_Get`                                         | `FileMetadata \| null`                         | `PasteService``TranslatePage``utils/input.ts`                                                                                                                  | →FileMetadata          |  `createEntry`  `getMetadata({kind:'path'})`                                 |
| `deleteFile(_, id)` → `File_Delete`                                         | `void`                                         | `FileManager.deleteFile`                                                                                                                                           |  `{storageDir}/{id}`                   | `FileIpcApi.permanentDelete({kind:'entry'})`                                             |
| `deleteDir(_, id)` → `File_DeleteDir`                                       | `void`                                         | /Notes                                                                                                                                                         | rm -rf                                 | handler  `permanentDelete`                                               |
| `deleteExternalFile(_, path)` → `File_DeleteExternalFile`                   | `void`                                         | `NotesService`                                                                                                                                                     |                            | `FileIpcApi.permanentDelete({kind:'path'})`                                           |
| `deleteExternalDir(_, path)` → `File_DeleteExternalDir`                     | `void`                                         | `NotesService`                                                                                                                                                     |                                |                                                                                        |
| `moveFile(_, path, newPath)` → `File_Move`                                  | `void`                                         | `NotesService`                                                                                                                                                     | fs.rename                                  | `FileIpcApi.rename(handle, newPath)`                                                       |
| `moveDir(_, dir, newDir)` → `File_MoveDir`                                  | `void`                                         | `NotesService`                                                                                                                                                     |                                |                                                                                        |
| `renameFile(_, path, newName)` → `File_Rename`                              | `void`                                         | `NotesService`                                                                                                                                                     | fs.rename `.md`                    |  `rename`                                                                            |
| `renameDir(_, path, newName)` → `File_RenameDir`                            | `void`                                         | `NotesService`                                                                                                                                                     |                                    |                                                                                        |
| `readFile(_, id, detectEncoding?)` → `File_Read`                            | `string`                                       | **4+ **`fileProcessor``TokenService``config/minapps``NotesPage`                                                                                    |  id docx/pdf/text  | `FileIpcApi.read({kind:'entry',entryId})`                                                |
| `readExternalFile(_, path, detectEncoding?)` → `File_ReadExternal`          | `string`                                       | `TranslatePage``NotesSearchService``InputbarCore``SaveToKnowledgePopup``export.ts``useNotesEditing``NotesQuery`                                        |                                | `FileIpcApi.read({kind:'path',path})`                                                 |
| `createTempFile(_, name)` → `File_CreateTempFile`                           | `string`                                       | `PasteService``TranslatePage``HtmlArtifactsCard`                                                                                                               |  `{tempDir}/temp_file_{uuid}_{name}`   | **** `handler-mapping.md:78`renderer  createEntry  mount_temp  |
| `writeFile(_, path, data)` → `File_Write`                                   | `void`                                         | `PasteService``TranslatePage``HtmlArtifactsCard``NotesService``NotesPage``exportExcel``export.ts`                                                      |                                  | `FileIpcApi.write({kind:'path',path}, data)`                                          |
| `writeFileWithId(_, id, content)` → `File_WriteWithId`                      | `void`                                         | `config/minapps``NewAppButton``MinApp`                                                                                                                         |  `{storageDir}/{id}`                     | `FileIpcApi.write({kind:'entry',...}, data)`                                             |
| `fileNameGuard(_, dir, name, isFile)` → `File_CheckFileName`                | `{safeName, exists}`                           | `NotesService``NotesPage`                                                                                                                                        | +                        | ****sanitize  shared                                                         |
| `mkdir(_, path)` → `File_Mkdir`                                             | `string`                                       | `NotesService`                                                                                                                                                     |                                    | **** v2 IPC `createEntry`                                          |
| `base64Image(_, id)` → `File_Base64Image`                                   | `{mime, base64, data}`                         | `aiCore/messageConverter``aiCore/fileProcessor`                                                                                                                  |  data URL                      | `FileIpcApi.read(handle, {encoding:'base64'})`                                             |
| `saveBase64Image(_, base64)` → `File_SaveBase64Image`                       | `FileMetadata`                                 | `messageStreaming/imageCallbacks`7  paintings                                                                                                                |  data URL                    | `FileIpcApi.createEntry({origin:'internal',content:Base64String})`                         |
| `savePastedImage(_, bytes, ext?)` → `File_SavePastedImage`                  | `FileMetadata`                                 | `components/RichEditor/useRichEditor`                                                                                                                              |                              | bytes → Uint8Array FileContent                                                     |
| `base64File(_, id)` → `File_Base64File`                                     | `{data, mime}`                                 | `FileManager.readBase64File``FileManager.addBase64File``fileProcessor`PDF                                                                                  |  base64                          | `FileIpcApi.read(handle, {encoding:'base64'})`                                             |
| `pdfPageCount(_, id)` → `File_GetPdfInfo`                                   | `number`                                       | ** renderer **`window.api.file.pdfInfo`                                                                                                              | PDF                                    |  `getMetadata` PDF  pageCount                                            |
| `binaryImage(_, id)` → `File_BinaryImage`                                   | `{data: Buffer, mime}`                         | `FileManager.readBinaryImage`                                                                                                                                      |  Buffer                          | `FileIpcApi.read(handle, {encoding:'binary'})`                                             |
| `clear()` → `File_Clear`                                                    | `void`                                         |  bcakup/debug                                                                                                                                                  |  storage                           | ****`handler-mapping.md:77`                                                  |
| `clearTemp()`                                                               | `void`                                         |                                                                                                                                                                |  temp dir                              |  IPCfile_module                                                            |
| `open(_, options)` → `File_Open`                                            | `{fileName, filePath, content?, size} \| null` | `BackupService``ImportPopup``ImportAssistantPresetPopup`                                                                                                       | dialog+                              | ****renderer  select+read                                                  |
| `openPath(_, path)` → `File_OpenPath`                                       | `void`                                         | `CitationsList``ClickableFilePath``FilesPage``KnowledgeDirectories``useAttachment`                                                                 | `shell.openPath`                           | `FileIpcApi.open({kind:'path',path})`                                                 |
| `openFileWithRelativePath(_, file)` → `File_OpenWithRelativePath`           | `void`                                         | `KnowledgeFiles``KnowledgeVideos`                                                                                                                                |  `{storageDir}/{name}`     | `FileIpcApi.open({kind:'entry',entryId})`                                                |
| `save(_, fileName, content, options?)` → `File_Save`                        | `string`                                       | `SaveDialog` + writeFile`MessageMenubar``MarkdownExportSettings``HtmlArtifactsCard``CodeBlockView``export.ts``AssistantPresetCard``useChatContext` | +                        | `FileIpcApi.save({content,filters?,defaultPath?})`                                         |
| `saveImage(_, name, data)` → `File_SaveImage`                               | `boolean`                                      | `Messages``MessageMenubar``HtmlArtifactsPopup``export.ts`                                                                                                    |  PNG                       |  `save` base64                                                               |
| `selectFolder(_, options?)` → `File_SelectFolder`                           | `string \| null`                               | `BackupService``useCodeCli``KnowledgeDirectories``AgentModal``AccessibleDirsSetting``MarkdownExportSettings``NotesSettings``exportExcel`             | Folder                               | `FileIpcApi.select({directory:true})`                                                      |
| `downloadFile(_, url)` → `File_Download`                                    | `FileMetadata`                                 | 6  paintings                                                                                                                                                   |  URL                         | `FileIpcApi.createEntry({origin:'internal',content:URLString})`                            |
| `copyFile(_, id, destPath)` → `File_Copy`                                   | `void`                                         | ** renderer **preload  `file.copy`                                                                                                   |                          | `FileIpcApi.copy`  internal entry `read + save`              |
| `getDirectoryStructure(_, path)` → `File_GetDirectoryStructure`             | `NotesTreeNode[]`                              | `NotesService``NotesPage`                                                                                                                                        | Notes                        | ****`handler-mapping.md:79`DataApi                                           |
| `listDirectory(_, path, options?)` → `File_ListDirectory`                   | `string[]`                                     | `useResourcePanel` (@-mention )                                                                                                                            | ripgrep fuzzy                          | `FileIpcApi.listDirectory(path, options)`                                                  |
| `validateNotesDirectory(_, path)` → `File_ValidateNotesDirectory`           | `boolean`                                      | `NotesService``NotesSettings`                                                                                                                                    | /                      | `FileIpcApi.validateNotesPath`                                                             |
| `startFileWatcher`/`stopFileWatcher`/`pauseFileWatcher`/`resumeFileWatcher` | `void`                                         | Notes                                                                                                                                                          | chokidar                               |  `FileIpcApi` NotesService  Notes  v2          |
| `getWatcherStatus()`                                                        | `{isActive, watchPath, hasValidSender}`        |  IPC                                                                                                                                                       | —                                          |                                                                                        |
| `getFilePathById(file)`                                                     | `string`                                       |                                                                                                                                                              | —                                          | Internal                                                                                   |
| `isTextFile(_, path)` → `File_IsTextFile`                                   | `boolean`                                      | `utils/file.ts:isSupportedFile``AttachmentPreview``SkillsSettings`                                                                                             | binary vs text                         | `FileIpcApi.getMetadata(handle).type === 'text'`                                           |
| `isDirectory(_, path)` → `File_IsDirectory`                                 | `boolean`                                      | `SkillsSettings`                                                                                                                                                   | stat.isDirectory                           | `FileIpcApi.getMetadata(handle).kind === 'directory'`                                      |
| `showInFolder(_, path)` → `File_ShowInFolder`                               | `void`                                         | `ClickableFilePath`                                                                                                                                                | `shell.showItemInFolder`                   | `FileIpcApi.showInFolder(handle)`                                                          |
| `batchUploadMarkdownFiles(_, paths, target)` → `File_BatchUploadMarkdown`   | `{fileCount, folderCount, skippedFiles}`       | `NotesService`                                                                                                                                                     |  md  notes dir                   | `FileIpcApi.batchCreateEntries`  Notes                                               |
| `onFileChange(callback)`                                                    | event subscribe                                | Notes                                                                                                                                                              | watcher                            |                                                                                        |

### 4.2 `FileService_*` IPCAI Provider 

`src/main/services/remotefile/{Base,OpenAI,Gemini,Mistral}Service.ts`

| IPC                    |                                                   |                                                                       |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `FileService_Upload`   | `(provider, file: FileMetadata) → FileUploadResponse` | `aiCore/fileProcessor:handleGeminiFileUpload/handleOpenAILargeFileUpload` |
| `FileService_List`     | `(provider) → FileListResponse`                       |  renderer                                                       |
| `FileService_Delete`   | `(provider, fileId) → void`                           |  renderer                                                       |
| `FileService_Retrieve` | `(provider, fileId) → FileUploadResponse`             |  Upload                                                             |

v2 AI SDK Files Upload API **Phase 1 **`src/main/data/db/schemas/file.ts:7-9` 

### 4.3 Preload  (`src/preload/preload.ts:218-286`)

`window.api.file.*` 47  2-3`window.api.fileService.*` 4 

---

## 5. DB /  / 

### 5.1 Dexie `files` 

`src/renderer/databases/index.ts``files`  v1~v10 schema 

```
files: 'id, name, origin_name, path, size, ext, type, created_at, count'
```

 `FileMetadata`  tokens/purpose  Dexie  arbitrary 

****

- `services/FileManager.ts:17,20,24,47,50,54,64,67,71,81,107,112,133,156`
- `pages/files/FilesPage.tsx:52,54`
- `services/db/DexieMessageDataSource.ts:400,412,416`
- `services/import/utils/database.ts`

****

- `message_blocks` v7+ `file.id` `MessageBlock.file.id`  Dexie `FileAction.handleDelete` `db.message_blocks.where('file.id').equals(fileId)`** Dexie→SQLite **

### 5.2 Main SQLite

`src/main/data/db/schemas/file.ts`

- `file_entry` §1 Schema
- `file_ref`polymorphic association
- **** `file_upload` AI SDK Files API 
- ****  `files`  FileMetadata  SQLite

 `fileEntrySeeding.ts` git status  `D src/main/data/db/seeding/fileEntrySeeding.ts` branch 

### 5.3  Migration

`src/main/data/migration/v2/migrators/`

- `KnowledgeMigrator.ts` Dexie `files`  FileMetadata `Map<id, FileMetadata>``loadFileLookup` item.content  legacy string id /  / **resolve  FileMetadata** `mappings/KnowledgeMappings.ts:148`** `knowledge_item.data`  JSON  FileMetadata ** `KnowledgeItemData.file: FileMetadata`"FileMetadata  v2 SQLite  JSON "
- **Message / Painting / Translate / Paste / Video**  migrator `message_blocks.file`  `PaintingsState.files`  `FileMetadata`  `FileEntry` +  `file_ref`  `file.id`uuidv4 `FileEntry.id`uuidv7

---

## 6. 

### 6.1 Chat Messages

******P**block.file  FileMetadata  Dexie `message_blocks`

****

- `ImageMessageBlock.file?: FileMetadata``types/newMessage.ts:105`
- `FileMessageBlock.file: FileMetadata``types/newMessage.ts:136`
- Dexie `message_blocks` v7+ `file.id` 

****

- `Inputbar.tsx` → `InputbarCore.tsx` →  `useFiles` / `usePasteHandler` / `useFileDragDrop`  `FileMetadata[]`
- `MessagesService.getUserMessage`  files  blocks`createFileBlock` / `createImageBlock` `utils/messageUtils/create.ts:182`
- blocks  Dexie `message_blocks`file 
- `Messages.tsx``MessageEditor.tsx`
- `FileAction.handleDelete` →  `message_blocks.where('file.id')` +  `topics.messages`  block id 
- `store/thunk/messageThunk.ts:592 cleanupMultipleBlocks`  block  files 
-  topic`hooks/useTopic.ts:231 clearTopicMessages`  files  FileManager.deleteFiles

** API**

- `file.select` / `file.upload``FileManager.uploadFile`
- `file.base64Image` / `file.base64File` / `file.read``aiCore/fileProcessor`
- `file.delete``FileManager.deleteFile` count 

****

- chat attach  **origin='internal'** Cherry 
- `file_ref` `sourceType='chat_message'`, `sourceId=blockId`, `role='attachment' \| 'image'`
- Block.file  fileEntryIdUI  `useQuery('/files/entries/:id')` lazy 

******XL**

-  Dexie→SQLite  `message_blocks`  v2 
- UI attach preview / chat  /  / 
- `count`  `file_ref`

### 6.2 Knowledge Base

******P + A**`KnowledgeItem.content`  FileMetadata  P preprocess provider  FileMetadata  path  A—— FileMetadata  path/extKnowledgeItem  FileEntrypreprocess provider  FileInfo

****

- `KnowledgeItem.content: string \| FileMetadata \| FileMetadata[]``types/knowledge.ts:13`
- `KnowledgeFileItem.content: FileMetadata``types/knowledge.ts:26`
- `KnowledgeVideoItem.content: FileMetadata[]``types/knowledge.ts:35`
- `KnowledgeReference.file?: FileMetadata``types/knowledge.ts:150`
- v2  schema`FileItemData.file: FileMetadata``src/shared/data/types/knowledge.ts:60`— ** FileMetadata **

****

- `KnowledgeFiles.tsx:124 processFiles(FileMetadata[])` → `addFilesThunk` → main `KnowledgeService.add`
- `useKnowledge.ts:134`  `window.api.file.delete(file.name)``store/knowledge.ts:46`  `FileManager.deleteFiles`
- `KnowledgeService.ts:searchKnowledgeBase`  `(KnowledgeSearchResult & {file: FileMetadata|null})[]`
- `KnowledgeVideos.tsx:125 openFileWithRelativePath(videoFile)`

****

- `KnowledgeService.ts:325 add({item.content as FileMetadata})` → `preprocessing` → 10+ preprocess providerMineru / Doc2x / Paddleocr / Mistral / Default / OpenMineru / PP-OCR
- `KnowledgeFileReader``knowledge/embedjs/loader/index.ts`

****

-  **origin='external'** ""  PDF  **origin='internal'**
- `file_ref` `sourceType='knowledge_item'`, `sourceId=itemId`, `role='source'`

******L** migrator 

- migrator `KnowledgeMappings.ts` inline FileMetadata JSON → FileEntry + fileRef 
- preprocess providers  `FileMetadata`  `file.path` `BasePreprocessProvider.ts:22` entry  handle

### 6.3 Painting

******P**`PaintingsState`  provider  `FileMetadata[]`/`FileMap<string, FileMetadata>`Redux  `FileEntryId[]`UI  useQuery 

****

- `PaintingsState.{provider}.files: FileMetadata[]` `types/index.ts:346` painting  state
-  provider  shape `FileMap<string, FileMetadata>` `{imageFiles, paths}`
- /reference`mask: FileMetadata``types/index.ts:390`

****

- `ImageUploader.tsx` provider  → `FileManager.uploadFile` →  state
- AI `Dmxapi/Aihubmix/Ppio/Ovms/NewApi/Silicon/Zhipu` Page → `window.api.file.{download,saveBase64Image}` → `FileManager.addFile`
- `FilesPage:63-77 handleBatchDelete`  `FileAction.handleDelete`  `paintings` 

****

- : **origin='internal'**
- :  UX user  **internal**
- `file_ref`: `sourceType='painting'`, `sourceId=paintingId`, `role='input' \| 'output'`
- Redux store  files  entryIdsUI  `useQuery` 

******L**

- Redux state  8  paintings page 
-  "filter by file.id"  " file_ref"
-  provider 

### 6.4 Translate

******I** →  FileMetadata  `FileInfo` `FileHandle` + 

****

- TranslatePage  state + `CustomTranslateLanguage`  FileMetadata `TranslatePage.tsx` 

****

- `TranslatePage.tsx:488 readFile(file)` 
- `TranslatePage.tsx:672-689`  drag+paste `file.createTempFile+write+get`  FileMetadata

** API**`file.get``file.createTempFile``file.write``file.readExternal``file.getPathForFile`

**** → `createEntry({origin:'internal'})` mount_temp/ 

******S**

-  state 
-  temp file  createEntry

### 6.5 Paste / Clipboard

******I  P** /  Inputbar —— `FileInfo` `createInternalEntry`  `FileEntry` message " DB"

****

- `services/PasteService.ts:handlePaste` 
  -  →  txt  `createTempFile + write + get`
  -  → `components/RichEditor/useRichEditor:518 savePastedImage(buffer, ext)`
- `pages/home/Inputbar/hooks/usePasteHandler.ts` 

****

- / `origin='internal'`Cherry  `tempSessionFileRef``src/shared/data/types/file/ref/tempSession.ts`session  message  promote  `chat_message` ref

******M**

-  tempSessionFileRef 

### 6.6 Notes

******I**Notes  FS-first FileMetadata `SaveToKnowledgePopup.readExternal`—— `FileInfo`  `FileHandle`** Notes  FileEntry**`docs/references/file/architecture.md §1.3`  Notes 

** FileMetadata **`NotesTreeNode` `src/main/utils/file.ts:128`  `MessagesService.ts`  `SaveToKnowledgePopup`  external path  markdown`SaveToKnowledgePopup.tsx:275 readExternal(note.externalPath)`  FileMetadata 

******M** `FileStorage.getDirectoryStructure/batchUploadMarkdown/fileNameGuard/watcher`  FileStorage  APIv2  NotesService 

### 6.7 Agent Workspace / MCP

******I**Agent workspace  AgentService  FileManagerMCP tool output `AgentSessionInputbar.tsx`  FileMetadata  Inputbar  Chat Messages  P  message  FileEntry 

- `ClickableFilePath.tsx:37 openPath / 62 showInFolder` — MCP tool output  FileMetadata
- `AgentSessionInputbar.tsx` —  FileMetadata  Inputbar 
- `AgentModal.tsx``AccessibleDirsSetting.tsx``useCodeCli.ts` —  `selectFolder`

******S**agent  FileMetadata

### 6.8 OCR / Preprocess

******I**OCR input " → " OCR 10+ provider  `file.path` —— `FileInfo` `FileHandle` managed/unmanaged `SupportedOcrFile`  `FileInfo & { type: 'image' }` **** txt/pdf Knowledge  FileEntry ops  FileInfo

****`SupportedOcrFile = ImageFileMetadata``types/ocr.ts:130`OCR services  `file.path` 

****

- `useOcr.ts` (renderer) → `OcrService.ocr(image, provider)` —  provider  IPC
- main  OCR service`TesseractService``SystemOcrService``OvOcrService``PpocrService` + 10  Preprocess Provider

****

- OCR input  `FileEntryId`  `FileHandle` main  `FileManager.read(id, {encoding:'binary'})`  `withTempCopy(id, fn)` 
- OCR  txt/pdf **origin='internal'**  entry

******L**

- OCR  10+ provider
- `ImageFileMetadata` " entry view"

### 6.9 AI Provider remotefile

******I**+  ID OpenAI fileId / Gemini file / Mistral fileId"" `FileHandle` /  `FileInfo` `file_upload` ""

`remotefile/` 4  serviceOpenAI/Gemini/Mistral/Base `FileMetadata` `file.path`  read streamPhase 1  `src/main/data/db/schemas/file.ts:7-9` ** file_upload ** `FileEntry` + `withTempCopy`  Phase 2 

******M**

### 6.10 Settings / Backup / Export

******I**Export Word / Zip Backup ——Cherry  `FilePath` / `FileInfo` FileManager

- `BackupService.ts` `selectFolder / open` —  FileMetadata 
- `utils/export.ts`1113  `file.save``file.saveImage``file.readExternal``file.write` — 
- `MarkdownExportSettings.tsx``AssistantPresetCard``selectFolder` + `save`
- ******S** IPC 

---

## 7. 

|             | FileMetadata      |      |  migrator? |        |                                                  |
| ----------------- | ----------------------- | ------------ | -------------- | ------------ | -------------------------------------------------------- |
| Chat Messages     | block.file      | 20+          |              | **XL**       | Dexie→SQLite message_blocks id v4→v7UI     |
| Knowledge Base    | item.content      | 15+          |    | **L**        | migrator  file_refpreprocess provider  |
| Painting          | state.files       | 8        |              | **L**        | Redux state  filter  join          |
| Translate         |  FileMetadata | 6          |              | **S**        |  temp file  API                              |
| Paste / Temp      |  FileMetadata | 3          |              | **M**        |  tempSessionFileRef                          |
| Notes             |       | 2          |              | **M**        |  FileStorage  Notes  API                   |
| Agent / MCP       |           | 5          |              | **S**        | IPC                                                  |
| OCR               | ImageFileMetadata | 10+          |              | **L**        | OCR provider types/ocr.ts                  |
| AI Remote Upload  | file.path     | 4  service |      | **M ()** | Phase 1                                            |
| Settings / Export | IPC       | 10+          |              | **S**        |                                                    |

** risk ranking** issue 

1. **`file.path` "resolve "** —  renderer  FileMetadata v2  `path`  `FileManager.getFilePath(entry)`  shim UI  AttachmentPreview / TranslatePage / MCP
2. **`count` → `file_ref` ** — handleDeletecleanupMultipleBlocks topicbatch delete  count  file_ref **** file_ref
3. **id  uuidv4 → uuidv7** —  migrator  Redux-persist  paintings state
4. **`ext` ** — `.pdf`  `pdf` codemod  renderer `file.ext === '.pdf'`  false
5. **Dexie `message_blocks`  `file.id`** —  `db.message_blocks.where('file.id').equals(fileId)`  SQLite  `file_ref` 
6. **Painting ** —  `FilesPage.handleBatchDelete`  paintings state  files v2  `file_ref` /

---

## 8. 



### 8.1 

|                                                                                                                                |                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/shared/data/types/file/file.ts`                                                                                              | index.ts  `export * from './file'`  `export * from './fileEntry'` |
| `src/renderer/types/file.ts`  `FileMetadata`/`ImageFileMetadata`/`PdfFileMetadata`/`isImageFileMetadata`                       |  renderer                                                                                       |
| `src/renderer/types/file.ts:134 PdfFileMetadata`                                                                                   | ****grep                                                                    |
| `src/renderer/databases/index.ts`  `files: EntityTable<FileMetadata, 'id'>`  `files: 'id, name, origin_name, ...'` | Dexie files                                                                                           |
| `src/renderer/services/FileManager.ts`                                                                                     |  `useQuery('/files/entries/:id')` + FileIpc                                                           |
| `src/renderer/services/FileAction.ts:handleDelete`  topics/messages  block                                           | v2  file_ref                                                                                      |
| `src/main/services/FileStorage.ts`                                                                                             | 2043  `src/main/file/{FileManager,ops/*}`                                                 |
| `src/main/services/remotefile/*`  `FileMetadata`                                                                                 | Phase 2+  FileEntryId                                                                                   |
| `src/renderer/services/db/DexieMessageDataSource.ts:400-416`                                                       | file_ref                                                                                                |
| `src/preload/preload.ts:218-286`  `file: {...}` 47                                                                               |  FileIpcApi `src/shared/types/file/ipc.ts`                                           |

### 8.2 

|                                                                                                                                                                    |                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `FileStorage`  Notes watcherbatchUploadMarkdownfileNameGuardvalidateNotesDirectorygetDirectoryStructurerenameDirmoveDirdeleteExternalDir | Notes                                                             |
| `remotefile/` 4  Service                                                                                                                                             |  AI SDK Files Upload API  `file_upload`                     |
| `FileStorage.downloadFile / saveBase64Image / savePastedImage`                                                                                                         | `createEntry`  URLString/Base64String/Uint8Array                |
| `FileStorage.copyFile`                                                                                                                                                 | ** renderer ** preload  `file.copy` |
| `FileStorage.pdfPageCount`                                                                                                                                             |  `FileIpcApi.getMetadata`PDF  pageCount                       |
| `FileStorage.base64Image / base64File / binaryImage`                                                                                                                   |  `FileIpcApi.read(handle, {encoding})`                              |

### 8.3 `knowledge.ts`  FileMetadataSchema

`src/shared/data/types/knowledge.ts:42`  `FileMetadataSchema: z.ZodType<FileMetadata>` `FileItemData`  ** FileMetadata **

-  SQLite `knowledge_item.data`  JSON 
-  KnowledgeMigrator  shape

** `KnowledgeItemData.file`  `FileEntryId`** query handler  JOIN fileEntry  file  renderer Batch A-E 

---

## 9. 

1. **Chat attach  internal  external**
   -  Cherry internalexternal
   -  `FileStorage.uploadFile`  internalv2 

2. **`count`  vs `file_ref` **
   - Phase 2 ""Dexie count  file_ref 
   - Phase 2  file_ref count  file_ref

3. **Knowledge Video  `content: FileMetadata[]`**
   - +v2  file_refrole=`video`/`subtitle`

4. **`file.id + file.ext` **
   - `{storageDir}/{id}{ext}`ext  `services/FileManager.getFilePath``FileStorage.storageDir``application.getPath('feature.files.data', '{id}{ext}')` v2 `FileEntry.ext`  `.` + ext

5. **`FileStorage`  watcher **
   -  Notes  FileStoragev2  NotesService  watcher file IPC

6. **OCR  `ImageFileMetadata` **
   -  `PhysicalFileMetadata`  `ImageFileMetadata` = `{kind:'file', type:'image', width, height, mime, size, ...}` `FileMetadata & {type:'image'}` OCR provider  width/height  OCR  `FileEntryId`provider  `withTempCopy` 

7. **Phase 2 **
   -  Dexie `files`  SQLite `file_entry`  →  → 

8. **tempSessionFileRef GC **
   - `src/shared/data/types/file/ref/tempSession.ts`  `sourceType='temp_session'`, `role='pending'` temp refsession  +  " ref  internal entry"  sweep

9. **Painting state  Redux-persist **
   - paintings state  electron-store  FileMetadatav2-refactor-temp  classification.json  paintings data-classify migrator 

10. **`getMetadata`  vs  2026-07-13**
    - ****`PhysicalFileMetadata` / `getMetadata` ——
      -  1 `stat` syscall`kind`file/dir`size`
      -  2`type``getFileType`** chardet  8KB**+ `mime`
      -  kind  size `isDirectory`size-gate  2
    - **Node **`fs.stat → Stats``isFile`/`isDirectory`/`size`/`mtime`  syscall  userland `fs.stat`  `ENOENT` `try/catch`
    - **** tier-1 `file.stat(handle) → {kind,size,createdAt,modifiedAt}``@main/utils/file`  `stat` —— `{size,createdAt,modifiedAt,isDirectory}``isDirectory`  `kind` IPC `getMetadata`  `stat + getFileType(+mime)` kind/size-only  `file.stat` Node `stat` —— fs  `ClickableFilePath` ****`AgentComposer`  catch  fs 
    - **2026-07-13**** `file.stat`** 2 C-1  IpcApi route `file.get_metadata``PhysicalFileMetadata | null`→`null` `isDirectory`  size-only **1+2 ** kind/size ——tier-1 
    - **C-12026-07-14** entry-arm `FileManager.getMetadata`  `type`  `'other'`path-arm  type route  `type`  handle —— bug `buildPhysicalFileMetadata(path, statResult)` → `type` entry-arm  `observeExternalAccess` stat****1/2 tier-1 `file.stat`  defer
    - **AgentComposer  reason ** workspace  `settingsBuilder`main `getPathStatus` missing / not_directory / inaccessible  boolean/`kind`  `inaccessible`C-1  Node —— `file.get_metadata`  stat  `throw`  domain-coded `IpcError`reason  IpcApi error  `getPathStatus` renderer  `e.code` **** AgentComposer  v1  reason →  demand-first  tier-1  defer
    - ****§8 [`filestorage-consumption-audit.md`](./filestorage-consumption-audit.md) §P4  `PhysicalFileMetadata` 

---

##  A

### FileMetadata 96  30

|                                                                                   |  |
| ------------------------------------------------------------------------------------- | -------- |
| `src/renderer/services/FileManager.ts`                                            | 18       |
| `src/main/services/FileStorage.ts`                                                    | 11       |
| `src/main/data/migration/v2/migrators/mappings/KnowledgeMappings.ts`                  | 11       |
| `src/renderer/components/Popups/VideoPopup.tsx`                                   | 9        |
| `src/renderer/pages/home/Inputbar/AttachmentPreview.tsx`                          | 7        |
| `src/main/services/KnowledgeService.ts`                                               | 6        |
| `src/renderer/pages/paintings/DmxapiPage.tsx`                                     | 6        |
| `src/renderer/preload/index.ts`                                                   | 6        |
| `src/renderer/pages/home/Inputbar/context/InputbarToolsProvider.tsx`              | 5        |
| `src/main/knowledge/preprocess/{Doc2x,Mistral}PreprocessProvider.ts`                  | 5        |
| `src/renderer/services/{Messages,Token}Service.ts`                                | 5        |
| `src/renderer/types/{newMessage,ocr,knowledge,file}.ts`                           | 4-6      |
| `src/renderer/store/thunk/messageThunk.ts`                                        | 4        |
| `src/renderer/pages/paintings/AihubmixPage.tsx`                                   | 4        |
| `src/renderer/aiCore/prepareParams/fileProcessor.ts`                              | 4        |
| `src/renderer/hooks/{useFiles,useKnowledge,useOcr,useKnowledgeFiles,useTopic}.ts` | 2-4      |
| … 60+                                                                     |          |

 `grep "FileMetadata\\b" -r src packages`

### v1 → v2 IPC 

 [`v2-refactor-temp/docs/file-manager/handler-mapping.md`](./handler-mapping.md)
