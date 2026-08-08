# Legacy File IPC  + 

> **** **legacy Electron IPC transport**`IpcChannel`  + `ipcMain.handle` / `this.ipcHandle` +  preload `window.api.file.*` / `window.api.fs.*` / `window.api.openPath`** file IPC channel****renderer file:line + ** [IpcApi](../../../docs/references/ipc/ipc-overview.md) 
>
> ****2026-07-03 · ****`eurfelux/refactor/file-ipc`
>
> ### 📌 
>
>  **2026-07-03 ** ****—— channel  ✅******** =  ✅ = 
>
> ** `IpcChannel` ""** channel  ✅ [§0 ](#0-)
>
> ⚠️ **** `file:line`  `origin/main` preload  `index.ts` `src/preload/preload.ts`****
>
> ** ≠ **"** file IPC**" channel  / schema / 
>
> - [`ipc-redesign.md`](./ipc-redesign.md) ⚠️ OUTDATED — 
> - [`handler-mapping.md`](./handler-mapping.md) ⚠️ OUTDATED —  v1→v2 handler 
> - [`migration-plan.md`](./migration-plan.md) — `FileMetadata` / `FileStorage` ****
> - IpcApi [`docs/references/ipc/ipc-overview.md`](../../../docs/references/ipc/ipc-overview.md)
>
> ********—— 2026-07-03  v1→v2 

---

## 0. 

 **36 ** legacy channelGroup A 6 + Group B 30**** §3 / §4 

### PR #16735 — `File_IsTextFile` / `File_IsDirectory` / `File_GetMetadata` → `file.get_metadata`

- [x] **`File_GetMetadata`**Group A→ IpcApi route `file.get_metadata` entry  `throw @phase2`  `buildPhysicalFileMetadata` `PhysicalFileMetadata | null`/ → `null`
- [x] **`File_IsDirectory`**B1→  `file.get_metadata` `meta?.kind === 'directory'``FileStorage.isDirectory` 
- [x] **`File_IsTextFile`**B1→  `file.get_metadata` `meta.type === 'text'`""****`@main/utils/file/metadata`  `getFileType` docstring
- [x]  channel  preload  `IpcChannel` 

###  PR

- [x] **`Open_Path`**B4→ IpcApi route `system.shell.open_path``src/main/ipc/handlers/system.ts` B1  `File_OpenPath`  channel**** B1 

### 

|  |  |  |  |
| --- | --- | --- | --- |
| Group A | 6 | 1 | **5** |
| Group B — B1 | 25 | 2 | **23** |
| Group B — B2 | 2 | 0 | **2** |
| Group B — B3 | 2 | 0 | **2** |
| Group B — B4 | 1 | 1 | **0** |
| **** | **36** | **4** | **32** |

 `src/shared/ipc/schemas/file.ts`  **14**  `file.*` IpcApi route §2

---

## 1. 

 file IPC  **3 ** **4 **** IpcApi**channel **2026-07-03** [§0](#0-)

|  |  |  |  | channel  |  |
| --- | --- | --- | --- | --- | --- |
| **** ✅ | `src/main/ipc/handlers/file.ts` | IpcApi route | v2 `FileManager` | 11 → **14** |  §2 |
| **Group A** ⚠️ | `src/main/services/file/FileManager.ts` `registerIpcHandlers()` | `this.ipcHandle(IpcChannel.*)` | v2 `FileManager` | 6 **5** | v2  legacy transport §3 |
| **Group B** ⚠️ | `src/main/ipc.ts` `registerIpc()` | `ipcMain.handle(IpcChannel.*)` |  | 30 **27** |  §4 |
|  | `src/main/services/file/tree/DirectoryTreeManager.ts` | `this.ipcHandle` + `sender.send` | v2 tree module | 4 | file tree §6 |

**Group B **

| Group B  |  | channel  |  |
| --- | --- | --- | --- |
| **B1** | v1 `FileStorage``src/main/services/FileStorage.ts`40KBipc.ts  import  `fileManager` | 25 **23** |  v1  |
| **B2** | `FileSystemService``src/main/services/FileSystemService.ts`918B | 2 | `Fs_Read` / `Fs_ReadText` |
| **B3** | v2 `tree/search``src/main/services/file/tree/search.ts`ripgrep | 2 | ** v2 ** transport  |
| **B4** ✅ |  `shell.openPath`ipc.ts  service | 1 **0** | `Open_Path` `system.shell.open_path` |

** = Group A(6) + Group B(30) = 36  4  32 **  preload-only  `getPathForFile``webUtils`** IPC** file IPC  §5

### 1.1 

 + ✅ =  channel  IpcApi [§0](#0-)

|  |  channel |  |
| --- | --- | --- |
| **Notes ** | `readExternal` `write` `mkdir` `rename` `renameDir` `deleteExternalFile` `deleteExternalDir` `move` `moveDir` `checkFileName` `validateNotesDirectory` `batchUploadMarkdown` `listDirectory` `selectFolder` | `services/NotesService.ts``pages/notes/NotesPage.tsx``services/NotesSearchService.ts``pages/notes/hooks/*``pages/notes/NotesSettings.tsx` |
| **Paintings** | `createInternalEntry` `getPhysicalPath` `binaryImage` | `pages/paintings/*` |
| **Export** | `save` `write` `saveImage` `readExternal` | `services/ExportService.ts``utils/exportExcel.ts` |
| **Composer / Paste** | `write` `createTempFile` `get` `getPathForFile` `fs.readText` | `components/composer/paste/pasteHandling.ts``components/composer/*` |
| **Artifact ** | `listDirectoryEntries` `listDirectory` ~~`isTextFile`~~ ~~`isDirectory`~~ ~~`getMetadata`~~ ✅ `fs.read` `fs.readText` | `components/chat/panes/*``components/ArtifactPreview/*` |
| ** / ** | `openPath` `showInFolder` ~~`getMetadata`~~ ✅ | `pages/*/messages/*Adapter``components/chat/*` |
| **Send-time ** | `createInternalEntry` `getPhysicalPath` ~~`getMetadata`~~ ✅ | `utils/file/buildFileParts.ts` |

### 1.2 

1. **Group A  channel  IpcApi  channel ** 3  renderer 
   - `File_PermanentDelete` IpcApi `file.batch_permanent_delete`  → renderer ****
   - `File_RunSweep`  → renderer ****
   - `File_EnsureExternalEntry`  mock → renderer ****
2. ✅ **~~`File_GetMetadata` handler ~~#16735** entry  `throw 'getMetadata(FileEntryHandle) is not yet wired (@phase 2)'` path  IpcApi  `file.batch_get_metadata`  route `file.get_metadata`  `buildPhysicalFileMetadata`
3. ** /  renderer ** `const { file } = window.api` renderer  `services/`  `FileManager`/`FileStorage`/`FileService`  `ImageStorage.ts` `window.api.file.<method>` / `window.api.fs.<method>` `NotesService`/`ExportService` ** pass-through**
4. **`getPathForFile`  IPC file IPC **`file.get` / `isDirectory` / `readExternal`

---

## 2.  IpcApi  file 

`src/main/ipc/handlers/file.ts` + `src/shared/ipc/schemas/file.ts` `window.api.ipcApi.request('file.*', ...)` **** channel

| IpcApi route |  |
| --- | --- |
| `file.batch_get_metadata` | `dispatchHandle` → `FileManager.getMetadata(entryId)` / `getMetadataByPath`**entry ** |
| `file.batch_get_physical_paths` | `FileManager.getPhysicalPath` |
| `file.batch_get_dangling_states` | `FileManager.batchGetDanglingStates` |
| `file.batch_create_internal_entries` | `FileManager.batchCreateInternalEntries` |
| `file.batch_trash` / `file.batch_restore` / `file.batch_permanent_delete` | `FileManager.batch*` |
| `file.empty_trash` | `FileManager.emptyTrash` |
| `file.rename` | `FileManager.rename` |
| `file.open` | `dispatchHandle` → `FileManager.open` / `safeOpen` |
| `file.show_in_folder` | `dispatchHandle` → `FileManager.showInFolder` / `showPathInFolder` |
| `file.get_metadata` 🆕 | `dispatchHandle` → `FileManager.getMetadata(entryId)` / `getMetadataByPath` `PhysicalFileMetadata \| null` |
| `file.read` 🆕 | `FileManager.read` |
| `file.write_if_unchanged` 🆕 | `FileManager.writeIfUnchanged` |

🆕 = 11  **14** `file.get_metadata`  PR #16735  [§0](#0-)
---

## 3. Group A — `FileManager.ts` legacy-transport channelv2 

 `FileManager.registerIpcHandlers()``src/main/services/file/FileManager.ts:670-711` `this.ipcHandle(IpcChannel.File_*)` v2 `FileManager` transport  IpcApi

| Channel | Handler  | Renderer `window.api.file.*` |  |  |
| --- | --- | --- | --- | --- |
| `File_CreateInternalEntry` | `this.createInternalEntry` | `createInternalEntry(params)` | **5** |  |
| `File_GetPhysicalPath` | `this.getPhysicalPath` | `getPhysicalPath(params)` | **3** |  |
| ✅ ~~`File_GetMetadata`~~ | ~~`dispatchHandle`entry `throw @phase2`path→`getMetadataByPath`~~ | ~~`getMetadata(handle)`~~ | ~~**2**~~ | ** `file.get_metadata`**#16735 |
| `File_EnsureExternalEntry` | `this.ensureExternalEntry` | `ensureExternalEntry(params)` | **0** ☠️ | 1  mock |
| `File_PermanentDelete` | `dispatchHandle`entry→`permanentDelete`path→`fsRemove` | `permanentDelete(handle)` | **0** ☠️ IpcApi  | — |
| `File_RunSweep` | `this.runSweep` | `runSweep()` | **0** ☠️ | — |

****

- `createInternalEntry`5
  - `src/renderer/utils/file/buildFileParts.ts:29` — send  composer  internal `FileEntry`
  - `src/renderer/pages/paintings/utils/downloadImages.ts:27` — base64 
  - `src/renderer/pages/paintings/utils/downloadImages.ts:31` —  URL 
  - `src/renderer/pages/paintings/hooks/usePaintingComposerInputFiles.ts:123` — 
  - `src/renderer/pages/paintings/model/runPainting.ts:23` — base64  legacy `FileMetadata` 
- `getPhysicalPath`3
  - `src/renderer/utils/file/buildFileParts.ts:30` —  `FileEntry`  `file://` URL
  - `src/renderer/pages/paintings/utils/fileEntryAdapter.ts:21` —  `FileEntry` →  `FileMetadata` 
  - `src/renderer/pages/paintings/hooks/usePaintingComposerInputFiles.ts:77` — seed  `FileEntry`  chip
- `getMetadata`2
  - `src/renderer/utils/file/buildFileParts.ts:31` —  MIMEpath handle `FileUIPart.mediaType`
  - `src/renderer/hooks/useFileSize.ts:29` —  handle  `fs.stat` 

> **☠️  channelrenderer **`ensureExternalEntry` / `permanentDelete` / `runSweep`  preload `src/preload/preload.ts:185,189,190` `src/renderer/`  `packages/` `ensureExternalEntry`  `SaveToKnowledgePopup.test.tsx:173`  `vi.fn()``permanentDelete`  FilesPage  IpcApi `file.batch_permanent_delete` `FilesPage.test.tsx:550-559``runSweep` renderer ** legacy channel + preload ** IpcApi 

> ** IPC **`FileManager`  preload/IPC`createInternalEntry` @ `src/main/ai/AiService.ts:551,579``src/main/ai/provider/custom/tasks/imageGenerationJobHandler.ts:168``permanentDelete` @ `imageGenerationJobHandler.ts:198``getMetadata` @ `src/main/features/fileProcessing/tasks/jobExecution.ts:142` IPC 

---

## 4. Group B — `src/main/ipc.ts` legacy channel

 `registerIpc()` `ipcMain.handle(IpcChannel.File_*/Fs_*/Open_Path)` B1–B4

### 4.1 B1 — v1 `FileStorage`  25  23

ipc.ts  `import { fileStorage as fileManager } from './services/FileStorage'`** v1 ** [`migration-plan.md`](./migration-plan.md)  `FileStorage`/`FileMetadata` 

| Channel | `FileStorage`  | Renderer  |  |
| --- | --- | --- | --- |
| `File_Write` | `writeFile` | `write` | 10 |
| `File_OpenPath` | `openPath` | `openPath` | 9 |
| `File_Save` | `save` | `save` | 8 |
| `File_ReadExternal` | `readExternalFile` | `readExternal` | 8 |
| `File_SelectFolder` | `selectFolder` | `selectFolder` | 8 |
| `File_Select` | `selectFile` | `select` | 7 |
| `File_Get` | `getFile` | `get` | 7 |
| `File_CheckFileName` | `fileNameGuard` | `checkFileName` | 5 |
| `File_CreateTempFile` | `createTempFile` | `createTempFile` | 4 |
| `File_SaveImage` | `saveImage` | `saveImage` | 3 |
| `File_ShowInFolder` | `showInFolder` | `showInFolder` | 3 |
| ✅ ~~`File_IsDirectory`~~ | ~~`isDirectory`~~ | ~~`isDirectory`~~ | ** `file.get_metadata`**`kind`#16735 |
| `File_Open` | `open` | `open` | 2 |
| `File_Move` | `moveFile` | `move` | 2 |
| `File_MoveDir` | `moveDir` | `moveDir` | 2 |
| `File_Mkdir` | `mkdir` | `mkdir` | 2 |
| ✅ ~~`File_IsTextFile`~~ | ~~`isTextFile`~~ | ~~`isTextFile`~~ | ** `file.get_metadata`**`type`#16735 |
| `File_ValidateNotesDirectory` | `validateNotesDirectory` | `validateNotesDirectory` | 2 |
| `File_Rename` | `renameFile` | `rename` | 1 |
| `File_RenameDir` | `renameDir` | `renameDir` | 1 |
| `File_DeleteExternalFile` | `deleteExternalFile` | `deleteExternalFile` | 1 |
| `File_DeleteExternalDir` | `deleteExternalDir` | `deleteExternalDir` | 1 |
| `File_BatchUploadMarkdown` | `batchUploadMarkdownFiles` | `batchUploadMarkdown` | 1 |
| `File_SavePastedImage` | `savePastedImage` | `savePastedImage` | 1 |
| `File_BinaryImage` | `binaryImage` | `binaryImage` | 1 |

**B1**

- `write`10`utils/exportExcel.ts:92``components/CodeBlockView/HtmlArtifactsCard.tsx:34``components/composer/paste/pasteHandling.ts:49``components/composer/paste/pasteHandling.ts:82``pages/translate/TranslatePage.tsx:623``pages/notes/NotesPage.tsx:168``services/NotesService.ts:108``services/NotesService.ts:305``services/ExportService.ts:334``services/ExportService.ts:383`
- `openPath`9`components/CodeBlockView/HtmlArtifactsCard.tsx:35``components/chat/panes/OpenExternalAppButton.tsx:84``components/chat/panes/OpenExternalAppButton.tsx:103``components/chat/citations/CitationsPanel.tsx:16``hooks/useAttachment.ts:25``pages/home/messages/homeMessageListAdapter.tsx:339``pages/agents/messages/agentMessageListAdapter.ts:143``pages/agents/components/Sessions.tsx:978``pages/knowledge/hooks/usePreviewKnowledgeSource.ts:47`
- `save`8`components/ImageViewer.tsx:129``components/CodeBlockView/view.tsx:181``components/CodeBlockView/HtmlArtifactsCard.tsx:45``components/chat/messages/hooks/useMessageExportActions.ts:41``saveTextFile` `hooks/resourceCatalog/useResourceCatalogController.ts:162``services/ExportService.ts:319``services/ExportService.ts:365``services/ExportService.ts:1040`
- `readExternal`8`components/Popups/SaveToKnowledgePopup.tsx:319``hooks/useNotesQuery.ts:67``pages/translate/TranslatePage.tsx:478``pages/notes/hooks/useNotesMenu.tsx:104``pages/notes/hooks/useNotesEditing.ts:48``pages/knowledge/components/AddKnowledgeItemDialog.tsx:110``services/ExportService.ts:1101``services/NotesSearchService.ts:93`
- `selectFolder`8`utils/exportExcel.ts:80``components/resource/WorkspaceSelector.tsx:120``hooks/useCodeCli.ts:150``pages/settings/DataSettings/MarkdownExportSettings.tsx:41``pages/notes/NotesSettings.tsx:40``pages/knowledge/components/AddKnowledgeItemDialog.tsx:211``services/BackupService.ts:105``services/BackupService.ts:115`
- `select`7`components/composer/tools/components/AttachmentButton.tsx:30``hooks/useFiles.ts:49``pages/code/CodeCliPage.tsx:442``components/resource/dialogs/import/ImportSkillDialog.tsx:80``components/resource/dialogs/import/ImportSkillDialog.tsx:99``pages/knowledge/components/AddKnowledgeItemDialog.tsx:192``pages/files/FilesPage.tsx:601`
- `get`7`utils/input.ts:20``utils/input.ts:47``components/composer/paste/pasteHandling.ts:50``components/composer/paste/pasteHandling.ts:83``components/composer/paste/pasteHandling.ts:98``pages/translate/TranslatePage.tsx:624``pages/translate/TranslatePage.tsx:626`
- `checkFileName`5`pages/notes/NotesPage.tsx:864``services/NotesService.ts:93``services/NotesService.ts:106``services/NotesService.ts:196``services/NotesService.ts:301`
- `createTempFile`4`components/CodeBlockView/HtmlArtifactsCard.tsx:33``components/composer/paste/pasteHandling.ts:48``components/composer/paste/pasteHandling.ts:79``pages/translate/TranslatePage.tsx:620`
- `saveImage`3`components/CodeBlockView/HtmlArtifactsPopup.tsx:151``components/chat/messages/hooks/useMessageExportActions.ts:45``saveImage`  → `messageMenuBarActions.tsx:238``services/ExportService.ts:1090`
- `showInFolder`3`components/chat/panes/OpenExternalAppButton.tsx:94``pages/home/messages/homeMessageListAdapter.tsx:343``pages/agents/messages/agentMessageListAdapter.ts:150`
- `isDirectory`3`components/composer/variants/AgentComposer.tsx:677``components/resource/dialogs/import/ImportSkillDialog.tsx:127``pages/agents/messages/agentMessageListAdapter.ts:157`
- `open`2`components/Popups/ImportPopup.tsx:46``services/BackupService.ts:130`
- `move`2`pages/notes/NotesPage.tsx:496``pages/notes/NotesPage.tsx:880`
- `moveDir`2`pages/notes/NotesPage.tsx:493``pages/notes/NotesPage.tsx:882`
- `mkdir`2`services/NotesService.ts:95``services/NotesService.ts:394`
- `isTextFile`2`utils/file.ts:93``isSupportedFile` `hooks/useIsTextFile.ts:44`
- `validateNotesDirectory`2`services/NotesService.ts:155``resolveNotesPath``pages/notes/NotesSettings.tsx:63`
- `rename`1`services/NotesService.ts:203`
- `renameDir`1`services/NotesService.ts:207`
- `deleteExternalFile`1`services/NotesService.ts:189`
- `deleteExternalDir`1`services/NotesService.ts:187`
- `batchUploadMarkdown`1`services/NotesService.ts:250`
- `savePastedImage`1`components/RichEditor/useRichEditor.ts:402`
- `binaryImage`1`pages/paintings/model/canonicalGenerate.ts:170`

### 4.2 B2 — `FileSystemService` 2 

| Channel |  | Renderer  |  |
| --- | --- | --- | --- |
| `Fs_Read` | `FileService.readFile` | `fs.read(pathOrUrl, encoding?)` | 5 |
| `Fs_ReadText` | `FileService.readTextFileWithAutoEncoding` | `fs.readText(pathOrUrl)` | 4 |

**B2**

- `fs.read`5`components/ImageViewer.tsx:75``components/ArtifactPreview/office/WordPreviewPanel.tsx:143``components/ArtifactPreview/office/PptxPreviewPanel.tsx:184``components/ArtifactPreview/pdf/PdfPreviewPanel.tsx:213``hooks/useAssistantCatalogPresets.ts:158`
- `fs.readText`4`components/chat/panes/ArtifactPane.tsx:268``components/composer/ComposerSurface.tsx:739``hooks/useAttachment.ts:18``pages/translate/TranslatePage.tsx:479`

### 4.3 B3 — v2 `tree/search` 2 

 handler  `src/main/services/file/tree/search.ts`  `listDirectory` / `listDirectoryEntries`ripgrep** v2** legacy transport —— transport

| Channel |  | Renderer  |  |
| --- | --- | --- | --- |
| `File_ListDirectory` | `search.listDirectory` | `listDirectory(dirPath, options?)` | 2 |
| `File_ListDirectoryEntries` | `search.listDirectoryEntries` | `listDirectoryEntries(dirPath, options?)` | 2 |

**B3**

- `listDirectory`2`components/composer/variants/agent/useAgentResourceSearchProvider.tsx:106`@-resource  3`pages/notes/NotesPage.tsx:279`
- `listDirectoryEntries`2`components/chat/panes/useArtifactFileTreeModel.ts:251` artifact `components/chat/panes/useArtifactFileTreeModel.ts:369` N+1 `isDirectory`

> `listDirectoryEntries`  `listDirectory` +  `isDirectory`  N+1  channel 

### 4.4 B4 —  `shell.openPath` 1  0✅

| Channel |  | Renderer  |  |
| --- | --- | --- | --- |
| ✅ ~~`Open_Path`~~ | ~~`ipc.ts`  `shell.openPath(path)`~~ | ~~**`window.api.openPath(path)`** `file.*`~~ | ** IpcApi route `system.shell.open_path`**`src/main/ipc/handlers/system.ts` PR |

> ⚠️ **`Open_Path`  `File_OpenPath`B1 channel**""`Open_Path` **`File_OpenPath`  B1 **—— B1  `system.shell.open_path` `file.*` 

---

## 5. Preload-only IPC`getPathForFile`

`window.api.file.getPathForFile(file)` → `webUtils.getPathForFile(file)``src/preload/preload.ts:214`** `ipcRenderer.invoke`** IPC ** file IPC ** `File`  `file.get` / `isDirectory` / `readExternal`

6`utils/input.ts:18``components/composer/paste/pasteHandling.ts:73``components/resource/dialogs/import/ImportSkillDialog.tsx:124``pages/translate/TranslatePage.tsx:612``pages/knowledge/components/AddKnowledgeItemDialog.tsx:43``pages/files/FilesPage.tsx:920`

---

## 6. File Tree channel

 `src/main/services/file/tree/DirectoryTreeManager.ts`  `this.ipcHandle` ** `FileManager.ts`  `ipc.ts`**—— file-module  legacy IPC surface 

| Channel |  | Renderer  |
| --- | --- | --- |
| `File_TreeCreate` | R→M | `window.api.tree.create(rootPath, options?)` |
| `File_TreeDispose` | R→M | `window.api.tree.dispose(treeId)` |
| `File_TreeRename` | R→M | `window.api.tree.rename(treeId, oldPath, newPath)` |
| `File_TreeMutation` | **M→R event**`sender.send` | `window.api.tree.onMutation(cb)` |

>  `File_TreeMutation`  **M→R ** IpcApi  event `IpcApiService.send` + `useIpcOn` request  [`docs/references/file/directory-tree.md`](../../../docs/references/file/directory-tree.md)

---

## 7. 

> ** / schema **

1. **renderer **`File_EnsureExternalEntry``File_PermanentDelete``File_RunSweep` IpcApi `runSweep`  channel +  preload `preload.ts:185,189,190` IpcApi 
2. ✅ **#16735**`File_GetMetadata`  `file.batch_get_metadata` 2 `buildFileParts``useFileSize`** path handle** ——** `file.get_metadata`** `File_IsDirectory` / `File_IsTextFile` `kind` / `type`  channel
3. **B3`listDirectory` / `listDirectoryEntries` v2** transport
4. ✅ **B4 `Open_Path`  `system.shell.open_path`** B1 `File_OpenPath` —— B1  route `file.*` 
5. **B1 ** 25  23 v1 `FileStorage` [`migration-plan.md`](./migration-plan.md)  `FileMetadata` ——`select`/`get`  `FileMetadata``readExternal`/`binaryImage`  v1 
6. **** channel  `vi.fn()` mock + `toHaveBeenCalledWith` IPC  stub"" `AgentChatArtifactPane.test.tsx:353`mock  `file.openPath``ArtifactPane.test.tsx`  40  `listDirectoryEntries`  mock/
7. **** §1.1 channel ——Notes PaintingsExportComposer/PasteArtifact  PR  v1/v2 
