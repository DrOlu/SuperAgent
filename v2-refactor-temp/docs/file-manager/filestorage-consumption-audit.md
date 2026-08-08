# FileStoragev1 —  vs 

> ℹ️ ** 2026-07-13**""`FilePath` / `AbsolutePathSchema` branded +  **§7******—— `as FilePath` cast 

> ****Group B1`src/main/ipc.ts`  v1 `FileStorage`  **25  legacy channel****** v2  ** /  / **
>
> ** transport **—— v1  API **** IpcApi
>
> ****channel  file:line  [`legacy-file-ipc-audit.md`](./legacy-file-ipc-audit.md) §4.1** + **
>
> ****2026-07-04 · ****`eurfelux/refactor/file-ipc`

---

## 0. 

|  |  |
| --- | --- |
| **** | [`rfc-file-manager.md`](./rfc-file-manager.md) **§7.2 File IPC** + §7.3  =  API §7.2 ** 1:1 ** →  |
| **** | ✅ **Reroute**§7.2 / `FileHandle` · ⛔ **Abolish**§7.2  · ⏸ **Defer** Notes→entry  / §12 DirectoryTreeBuilder |
| **** |  + §7.2  X §5 |
| **Notes ** |  FS `mkdir`/`move*`/`rename*`/`deleteExternal*`/`write`(note )/`checkFileName`/`validateNotesDirectory` **Defer** |

**§7.2  `FileHandle` **`FileHandle = FileEntryHandle { kind:'entry', entryId } | FilePathHandle { kind:'path', path }`path  reroute =  `{ kind:'path', path }`entry  = `{ kind:'entry', entryId }`

### 0.1 

** `window.api.file.*` / `window.api.fs.*`**—— legacy preload v2  **IpcApi**[`ipc-overview.md`](../../../docs/references/ipc/ipc-overview.md)

```ts
import { ipcApi } from '@renderer/ipc'
await ipcApi.request('file.<action>', input)   // route  dot-snakenamespace.action
```

RFC §7.2  camelCase `getMetadata``createInternalEntry` IpcApi  dot-snake route`file.get_metadata``file.create_internal_entry`** IpcApi  14  file  batch **`get_metadata`  C-1 `read` / `write_if_unchanged` —— Reroute/Abolish ****schema + handler + preload  IpcApi 

| §7.2  | IpcApi route |  |
| --- | --- | --- |
| `open` | `file.open` | ✅ `FileHandle` |
| `showInFolder` | `file.show_in_folder` | ✅ `FileHandle` |
| `rename` | `file.rename` | ✅ entry-only |
| `getMetadata` | `file.get_metadata` | ✅ ****C-12026-07-13 `PhysicalFileMetadata \| null` |
| `getPhysicalPath` | `file.get_physical_path` | ⚠️ **** `file.batch_get_physical_paths` |
| `createInternalEntry` | `file.create_internal_entry` | ⚠️ **** `file.batch_create_internal_entries` |
| `select` | `file.select` | ⛔ **** |
| `save` | `file.save` | ⛔ **** |
| `read` | `file.read` | ⛔ **** |
| `write` | `file.write` | ⛔ **** |
| `ensureExternalEntry` | `file.ensure_external_entry` | ⛔ **** |

>  vs batch  `get_metadata`/`create_internal_entry`  batch  1  [`legacy-file-ipc-audit.md`](./legacy-file-ipc-audit.md) §7  #2 route route  API 

---

## 1. 25 

| Channel`window.api.file.*` | v1 `FileStorage`  |  |  | §7.2  |  |
| --- | --- | --- | --- | --- | --- |
| `select` | dialog → ** `FileMetadata[]`** uuid`count:1` | ⛔ Abolish | **P1** | `select` → `string[]` | 7 |
| `selectFolder` | dialog → `string\|null` | ✅ Reroute | — | `select({directory})` | 8 |
| `open` | dialog + read(<2GB) → `{filePath,content,size}` | ⛔ Abolish |  | `select` + `read` | 2 |
| `save` | save dialog + `writeFileSync` | ✅ Reroute | — | `save({content,...})` | 8 |
| `saveImage` | PNG save dialog +  base64 | ⛔ Abolish | **P5** | `save({content:bytes,filters:[png]})` | 3 |
| `get` | ** `FileMetadata`** uuid`count:1` | ⛔ Abolish | **P1** | `getMetadata(FileHandle)` | 7 |
| `readExternal` | `readFileCore` path | ✅ Reroute¹ | — | `read({kind:'path'},{text})` | 8 |
| `binaryImage` |  `storage/{id}` → `{data,mime}` | ⛔ Abolish | **P5** | `read({kind:'entry'},{binary})` | 1 |
| `savePastedImage` |  `storage/{uuid}{ext}` +  → `FileMetadata` | ⛔ Abolish | **P5** | `createInternalEntry({source:'bytes'})` | 1 |
| `createTempFile` | **** | ⛔ Abolish | **P2** | `createInternalEntry({source:'bytes'})`² | 4 |
| `write` |  `fs.writeFile(path,data)` | 🔀 Split | P2 / — / Defer |  §4.3 | 10 |
| `mkdir` |  `fs.mkdir(recursive)` | ⏸ Defer | **P3** | —Notes | 2 |
| `move` |  `fs.rename` | ⏸ Defer | **P3** | —Notes | 2 |
| `moveDir` |  `fs.rename` | ⏸ Defer | **P3** | —Notes | 2 |
| `rename` |  `fs.rename` + ** `.md`** | ⏸ Defer | **P3** | —Notes | 1 |
| `renameDir` |  `fs.rename` | ⏸ Defer | **P3** | —Notes | 1 |
| `deleteExternalFile` | **`shell.trashItem`** | ⏸ Defer | **P3** | —Notes³ | 1 |
| `deleteExternalDir` | `shell.trashItem` | ⏸ Defer | **P3** | —Notes | 1 |
| `batchUploadMarkdown` |  .md +  | ⏸ Defer | **P3** | —Notes | 1 |
| `checkFileName` | `checkName`+`getName`  +  `.md` | ⏸ Defer⁴ | **P3** | —Notes | 5 |
| `validateNotesDirectory` | notes  | ⏸ Defer | **P3** | —Notes | 2 |
| `isTextFile` | chardet + isBinaryFile buffer  | ⛔ Abolish | **P4** | `getMetadata().type==='text'`⁵ | 2 |
| `isDirectory` | `fs.stat().isDirectory()` | ⛔ Abolish | **P4** | `getMetadata().kind==='directory'` | 3 |
| `showInFolder` | `shell.showItemInFolder`home  | ✅ Reroute | — | `showInFolder(FileHandle)` | 3 |
| `openPath` | `shell.openPath`home  | ✅ Reroute | — | `open(FileHandle)`⁶ | 9 |

> ¹ `readExternal` **** Notes-DeferQ3  mutation `readFileCore` v2 `read`  §5 ②
> ² temp-file  v2  §5 ①
> ³ v1  `shell.trashItem`§7.2 `permanentDelete`  path  `ops.remove`——**** §4.4
> ⁴ `checkFileName`  sanitize  shared  Notes  §4.4
> ⁵ `getMetadata`  buffer OTHER→TEXT §5 ③
> ⁶  `window.api.openPath``Open_Path` §4.2

****✅ Reroute 5 · ⛔ Abolish 9 · ⏸ Defer 10 · 🔀 Split 1`write`

---

## 2. P1–P5

 +  +  file:line  `src/renderer/`

### P1 —  DB `select` / `get`

****`selectFile` / `getFile` **** `FileMetadata`——`id: uuidv4()` id`count: 1``origin_name` DB v2 RFC §4.5.3 → `FileInfo` / `PhysicalFileMetadata` id/count → `FileEntry` sanctioned **" id "**

****

```ts
//  Asize/type/mime/kind
const meta = await ipcApi.request('file.get_metadata', { kind: 'path', path })   // PhysicalFileMetadata id

//  B→  get  id
const entry = await ipcApi.request('file.create_internal_entry', { source: 'path', path })  // Cherry 
//  ipcApi.request('file.ensure_external_entry', { externalPath: path })
```

****

- `select`7 P1`components/composer/tools/components/AttachmentButton.tsx:30``hooks/useFiles.ts:49``pages/code/CodeCliPage.tsx:442``components/resource/dialogs/import/ImportSkillDialog.tsx:80,99``pages/knowledge/components/AddKnowledgeItemDialog.tsx:192``pages/files/FilesPage.tsx:601`
  - **CodeCliPage:442**→  `string`  `select({...})`  path** metadata **
  - **AttachmentButton / AddKnowledgeItemDialog / FilesPage**/→ `select`  paths `createInternalEntry({source:'path'})`
  - **ImportSkillDialog:80,99** zip / →  path skill  IPC FileMetadata
- `get`7 P1`utils/input.ts:20,47``components/composer/paste/pasteHandling.ts:50,83,98``pages/translate/TranslatePage.tsx:624,626`
  - `pasteHandling:50,83`  `TranslatePage:624`  **P2 temp-file dance **`createTempFile→write→get`—— `createInternalEntry({source:'bytes'})`  `get` ****entry +
  - `input.ts:20,47` →  metadata →  B`createInternalEntry`/`ensureExternalEntry`
  - `pasteHandling:98` / `TranslatePage:626` path→  `getMetadata`

### P2 — Renderer `createTempFile` + `write` + `get`

****renderer ——`createTempFile(name)`  → `write(path, bytes)`  → `get(path)`  `FileMetadata`——"" renderer v2  `createInternalEntry({source:'bytes'|'base64'})`RFC §7.3  3+ entry+temp mount service ** temp **

****

```ts
// v1createTempFile → write → get IPC + renderer legacy preload
const tmp = await window.api.file.createTempFile('pasted_text.txt')
await window.api.file.write(tmp, bytes)
const meta = await window.api.file.get(tmp)

// v2 IpcApi
const entry = await ipcApi.request('file.create_internal_entry', { source: 'bytes', data: bytes, name: 'Pasted Text', ext: 'txt' })
//  await ipcApi.request('file.get_physical_path', { id: entry.id })
```

****

- `createTempFile`4`components/CodeBlockView/HtmlArtifactsCard.tsx:33``components/composer/paste/pasteHandling.ts:48,79``pages/translate/TranslatePage.tsx:620`
- `write`  temp 4`HtmlArtifactsCard.tsx:34``pasteHandling.ts:49,82``TranslatePage.tsx:623`
- `get`  temp 3 P1`pasteHandling.ts:50,83``TranslatePage.tsx:624`

> ****`HtmlArtifactsCard``createTempFile→write→openPath` " OS" `createInternalEntry`  v2  temp-file story§5 ①**** Abolish-P2 

### P4 — `isTextFile` / `isDirectory`

****"/"v2 `getMetadata(FileHandle)`  `kind``'file'|'directory'` `type``'text'|'image'|...` stat ** getMetadata **

****

```ts
// isDirectory(path) → const m = await ipcApi.request('file.get_metadata', {kind:'path',path}); m.kind === 'directory'
// isTextFile(path)  → const m = await ipcApi.request('file.get_metadata', {kind:'path',path}); m.type === 'text'
```

****

- `isDirectory`4`components/composer/variants/AgentComposer.tsx`workspace `components/composer/paste/useFileDragDrop.ts``getDroppedPathKind``components/resourceCatalog/dialogs/import/ImportSkillDialog.tsx``pages/agents/messages/agentMessageListAdapter.ts`→ `ClickableFilePath`
- `isTextFile`2`utils/file.ts``isSupportedFile` `hooks/useIsTextFile.ts`
  - chardet buffer  slice  `@main/utils/file/metadata`  `getFileType`§5 ③****

> **✅ C-12026-07-13** IpcApi route `file.get_metadata` `PhysicalFileMetadata | null`/→`null` `batch_get_metadata` ** reason **——`isDirectory`(4) + `getMetadata`(4 `useFileSize`/`buildFileParts`)  route legacy `File_IsDirectory` / `File_GetMetadata` preload + FileManager handler `FileStorage.isDirectory`AgentComposer  v1 / `inaccessible`—— missing/not_directory/inaccessible  defer [`filemetadata-consumer-audit.md`](./filemetadata-consumer-audit.md) §9(10)

> **-vs- 2026-07-13**`getMetadata`  kind `isDirectory` 2 `type`/`mime` chardet  8KBext ** `getMetadata`** tier-1 `file.stat` Node  [`filemetadata-consumer-audit.md`](./filemetadata-consumer-audit.md) §9(10)

### P5 — /`saveImage` / `savePastedImage` / `binaryImage`

****v2  create/read/save 

| v1 |  | v2 IpcApi |
| --- | --- | --- |
| `saveImage(name, dataUrl)` | PNG save dialog +  base64 | `ipcApi.request('file.save', { content: bytesFromDataUrl, defaultPath: name+'.png', filters:[png] })` |
| `savePastedImage(bytes, ext)` |  storage +  → `FileMetadata` | `ipcApi.request('file.create_internal_entry', { source:'bytes', data, name, ext })` |
| `binaryImage(id)` |  storage/{id} → `{data,mime}` | `ipcApi.request('file.read', { handle:{ kind:'entry', entryId }, encoding:'binary' })` |

****

- `saveImage`3`components/CodeBlockView/HtmlArtifactsPopup.tsx:151``components/chat/messages/hooks/useMessageExportActions.ts:45``saveImage`  → `messageMenuBarActions.tsx:238``services/ExportService.ts:1090` — "" `save`renderer  dataURL  bytes`save` content  `string|Uint8Array`
- `savePastedImage`1`components/RichEditor/useRichEditor.ts:402` —  → `createInternalEntry({source:'bytes'})`
- `binaryImage`1`pages/paintings/model/canonicalGenerate.ts:170` —  v2 `FileEntryId` → `read({kind:'entry'}, {binary})`

### `open`dialog + read— 

****`open`  + (<2GB)§7.2 handler-mapping  `select` + `read`renderer 

```ts
// v1 const { content } = await window.api.file.open({ filters })   // legacy preload
// v2 IpcApi select + read
const picked = await ipcApi.request('file.select', { filters })       // string | string[] | null
const p = Array.isArray(picked) ? picked[0] : picked
if (p) {
  const { content } = await ipcApi.request('file.read', { handle: { kind:'path', path: p }, encoding:'text' })
}
```

****2`components/Popups/ImportPopup.tsx:46` ChatGPT  JSON`services/BackupService.ts:130`

---

## 3. Reroute— /

 §7.2 

| Channel |  route |  |  |
| --- | --- | --- | --- |
| `selectFolder` | `file.select``{directory:true}`⛔ | `ipcApi.request('file.select', {directory:true})` `string\|null` | `utils/exportExcel.ts:80``components/resource/WorkspaceSelector.tsx:120``hooks/useCodeCli.ts:150``pages/settings/DataSettings/MarkdownExportSettings.tsx:41``pages/notes/NotesSettings.tsx:40``pages/knowledge/components/AddKnowledgeItemDialog.tsx:211``services/BackupService.ts:105,115` |
| `save` | `file.save` ⛔ | `ipcApi.request('file.save', { content, defaultPath?, filters? })`v1 `save(fileName, content, options)`  → v2 save dialog +  | `components/ImageViewer.tsx:129``components/CodeBlockView/view.tsx:181``components/CodeBlockView/HtmlArtifactsCard.tsx:45``components/chat/messages/hooks/useMessageExportActions.ts:41``hooks/resourceCatalog/useResourceCatalogController.ts:162``services/ExportService.ts:319,365,1040` |
| `readExternal` | `file.read` ⛔ | `ipcApi.request('file.read', { handle:{kind:'path',path}, encoding:'text', detectEncoding? })`⚠️  §5 ② | `components/Popups/SaveToKnowledgePopup.tsx:319``hooks/useNotesQuery.ts:67``pages/translate/TranslatePage.tsx:478``pages/notes/hooks/useNotesMenu.tsx:104``pages/notes/hooks/useNotesEditing.ts:48``pages/knowledge/components/AddKnowledgeItemDialog.tsx:110``services/ExportService.ts:1101``services/NotesSearchService.ts:93` |
| `showInFolder` | `file.show_in_folder` ✅ | `ipcApi.request('file.show_in_folder', {kind:'path',path})` | `components/chat/panes/OpenExternalAppButton.tsx:94``pages/home/messages/homeMessageListAdapter.tsx:343``pages/agents/messages/agentMessageListAdapter.ts:150` |
| `openPath` | `file.open` ✅ | `ipcApi.request('file.open', {kind:'path',path})` `Open_Path`  §4.2 | `components/CodeBlockView/HtmlArtifactsCard.tsx:35``components/chat/panes/OpenExternalAppButton.tsx:84,103``components/chat/citations/CitationsPanel.tsx:16``hooks/useAttachment.ts:25``pages/home/messages/homeMessageListAdapter.tsx:339``pages/agents/messages/agentMessageListAdapter.ts:143``pages/agents/components/Sessions.tsx:978``pages/knowledge/hooks/usePreviewKnowledgeSource.ts:47` |
| `write` | `file.write` ⛔ | `ipcApi.request('file.write', { handle:{kind:'path',path}, data })` | `utils/exportExcel.ts:92``services/ExportService.ts:334,383` |

> **`readExternal`  Notes **8  6  Notes `useNotesQuery`/`useNotesMenu`/`useNotesEditing`/`AddKnowledgeItemDialog`/`ExportService`/`NotesSearchService`**** Notes→entry  reroute  `ipcApi.request('file.read', {handle:{kind:'path'}})`—— Notes  entry Reroute Defer

---

## 4. Defer Notes 

Notes  `fs` v2 (a) Notes  `FileEntry` (b)  §12 `DirectoryTreeBuilder`****

### 4.1 Defer 

| Channel |  |  |
| --- | --- | --- |
| `mkdir` | `services/NotesService.ts:95,394` | —— Notes  entry  `createInternalEntry({type:'dir'})`  |
| `move` / `moveDir` | `pages/notes/NotesPage.tsx:493,496,880,882` |  + entry  `move(entryId, newParent)` |
| `rename` | `services/NotesService.ts:203` |  rename + ** `.md`**entry  rename  renderer  |
| `renameDir` | `services/NotesService.ts:207` |  ext |
| `deleteExternalFile` / `deleteExternalDir` | `services/NotesService.ts:187,189` |  §4.4  |
| `batchUploadMarkdown` | `services/NotesService.ts:250` |  .md + entry  `batchCreateEntries` |
| `checkFileName` | `pages/notes/NotesPage.tsx:864``services/NotesService.ts:93,106,196,301` |  + Notes  |
| `validateNotesDirectory` | `services/NotesService.ts:155``pages/notes/NotesSettings.tsx:63` | notes  |
| `write`note  | `pages/notes/NotesPage.tsx:168``services/NotesService.ts:108,305` |  |

### 4.2 `openPath`  channel 

`window.api.file.openPath``File_OpenPath`→`FileStorage.openPath` `window.api.openPath``Open_Path`→ `shell.openPath`****"" home §7.2  `open(FileHandle)`****—— `Open_Path`  5  [`legacy-file-ipc-audit.md`](./legacy-file-ipc-audit.md) §4.4 `open(FileHandle)`

### 4.3 `write` 

`write`  B1  channel10 

|  |  |  |
| --- | --- | --- |
|  | ✅ Reroute§3 | `exportExcel.ts:92``ExportService.ts:334,383` |
| temp-file dance | ⛔ Abolish P2§2 | `HtmlArtifactsCard.tsx:34``pasteHandling.ts:49,82``TranslatePage.tsx:623` |
| Notes  | ⏸ Defer§4.1 | `NotesPage.tsx:168``NotesService.ts:108,305` |

### 4.4 Defer 

 Notes  Defer entry 

1. **`checkFileName`  sanitize**`checkName(fileName)`  `@shared` renderer  IPC Notes handler-mapping 
2. **`deleteExternal*` **v1  `shell.trashItem`§7.2 `permanentDelete`  path  `ops.remove`**** Notes  `permanentDelete(FilePathHandle)` **""""**—— trash  §7.2  `trashItem`  §5 ④

---

## 5. §7.2  /  API

Q2 §7.2 

| # |  |  |  |
| --- | --- | --- | --- |
| ① | **temp-file **`createTempFile` + write-to-temp " OS"HTML  `createInternalEntry`  | `HtmlArtifactsCard.tsx:33,34,35` | (a) temp mount  entry + `getPhysicalPath` (b)  `writeTemp(bytes)→path` **§7.2 ** |
| ② | **`read` **v1 `readExternal`→`readFileCore`  doc/pdf/xlsx §7.2 `read`  text/base64/binary | `TranslatePage.tsx:478` |  §7.2 `read(text)`  IPCcf. `Pdf_ExtractText`  |
| ③ | **`getMetadata`  buffer **v1 `isTextFile`  chardet  ext  | `utils/file.ts:93``hooks/useIsTextFile.ts:44` |  §7.2 `getMetadata.type`  buffer migration-plan §2.5  ext  |
| ④ | **`trashItem`**§7.2  `permanentDelete`"" | `deleteExternalFile/Dir`Notes | Notes  trash  §7.2  `trashItem(FilePathHandle)` |

---

## 6. 

- ****✅ Reroute 5  + `write` —— `ipcApi.request('file.X', ...)`** route **§0.1`openPath`/`showInFolder`  `file.open`/`file.show_in_folder``select`/`save`/`read`/`write`  route
- ****⛔ Abolish 9 P1  metadataP2 temp-danceP4 P5  + `open` —— transport**** §2" API " `file.get_metadata` / `file.create_internal_entry` / `file.read`  route§0.1
- **DeferNotes**10  + `write` —— Notes→entry  sanitize `deleteExternal*`  trash §4.4
- ****§0.1  route  vs  batch+ §5 temp-file ①read ②getMetadata ③trashItem④——

**** IpcApi §0.1schema+handler/ `AbsoluteFilePathSchema.parse()`  brand——**`as`  lint  `filepath-brand/no-as-filepath` ** §7→ Reroute §3→ P1/P4 Abolish `file.get_metadata`→  §5  → P2/P5 Abolish①→ Notes Defer  PR§7****

---

## 7. ✅  #16740 

> **#16740 ** §7.4 ****——`AbsoluteFilePathSchema` `AbsolutePathSchema` `.brand<'AbsoluteFilePath'>()` brand `FilePathHandleSchema.path`  `FilePath`  `AbsoluteFilePath`**`as FilePath`  lint  `filepath-brand/no-as-filepath` ** `AbsoluteFilePathSchema.parse()` / `.safeParse()`
>
> **** §7.6`select` / `save` `FileHandle`  brand
>
>  §7.1–§7.5 ****

### 7.1 

§7.2  `select` / `save` ** `string`**`string[] | null` / `string | null` `getPhysicalPath`  `FilePath``FilePathHandle.path` / `FileInfo.path`  `FilePath`"" `select`/`save` 

****v2 " →  `FilePathHandle` "`select` → `read({kind:'path', path})`****——`select`  `string``FilePathHandle.path`  `FilePath` `as FilePath` handle

### 7.2 ""

|  |  |  |
| --- | --- | --- |
| `FilePath``src/shared/types/file/common.ts:38` |  `` `/${string}` \| `${string}:\\${string}` `` | ** hint brand** "Runtime validation required — the template-literal pattern only provides type-level hints" |
| `AbsolutePathSchema``src/shared/data/types/file/fileEntry.ts:143` | `z.string().min(1).refine(...)` | `.refine`  → **`z.infer`  `string` `FilePath`** |

`FilePathHandleSchema.path``handle.ts:55` `AbsolutePathSchema`  `string` TS  `FilePathHandle.path`  `FilePath`—— `as`  TODO `src/shared/types/file/handle.ts:59-60`

```ts
// TODO: 1. Wire schema and types, so no as cast needed
// TODO: 2. Add brand for FileHandle since factory function has been used
```

`select`/`save` **** `FilePath` brand `AbsolutePathSchema`infer  `string` API  `as`  `FilePath`  select/save  cast

### 7.3 

 `FilePathHandle` / `read` / `write`  `select`/`save`/`getPhysicalPath` 

-  `select→handle``get_metadata({kind:'path'})``write({kind:'path'})`  `as FilePath`
-  3  `as`-cast 
- §0.1  route  schema `AbsolutePathSchema`  `string` +  `as FilePath`

**2026-07-13******——`as FilePath` cast 

### 7.4 

**" +  branded"**

-  `AbsolutePathSchema`  branded `FilePath``.refine(...).transform((s) => s as FilePath)` `z.brand` brand 
- `select`/`save`  `FilePath | null` / `FilePath[] | null``getPhysicalPath` / `FilePathHandle.path` / `FileInfo.path` / `read`·`write` 
- brand  IPC  string IPC  schema ——
-  `handle.ts:59-60`  TODOno `as` cast + FileHandle brand

****picked path → `FilePathHandle` ** cast** `as FilePath` 

### 7.5 

- `src/shared/types/file/common.ts``FilePath` 
- `src/shared/data/types/file/fileEntry.ts``AbsolutePathSchema`
- `src/shared/types/file/handle.ts``FilePathHandle` + `FilePathHandleSchema` +  TODO
- `src/shared/types/file/info.ts``FileInfo.path`
- `src/shared/ipc/schemas/file.ts` `batch_get_physical_paths`  `AbsolutePathSchema.nullable()` + §0.1  route
- `FileManager.getPhysicalPath`  `FilePath` 

> `z.brand` vs phantom-brand `transform` `Base64String`/`UrlString`/`UrlString`  sibling ****

### 7.6 #16740 

- **`select` / `save`  `string`**`ipc.ts`  `select(...): Promise<string[]>`§7.1 " handle"**** `as`  `AbsoluteFilePathSchema.parse()`——
- **`handle.ts`  TODO **schema TODO 1 ✅`FileHandle`  brand TODO 2 `src/shared/data/types/file.ts:354-355`
- [#17431](https://github.com/Hyperspace Technologies/superagent/issues/17431)`AgentWorkspacePathSchema`  brand [#17429](https://github.com/Hyperspace Technologies/superagent/issues/17429) brand 
