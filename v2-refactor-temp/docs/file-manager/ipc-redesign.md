# File Module IPC Redesign

> **⚠️ OUTDATED / SUPERSEDED2026-04-21**
>
> /
>
> - `FileManager.createEntry({origin})`  `createInternalEntry` + `ensureExternalEntry`A-7
> - External entry  trash `fe_external_no_delete` CHECK
> - `externalPath`  partial unique  global unique
> - `permanentDelete`  external  DB 
>
> ****
>
> - [`docs/references/file/architecture.md`](../../../docs/references/file/architecture.md)
> - [`docs/references/file/file-manager-architecture.md`](../../../docs/references/file/file-manager-architecture.md)
> - [`rfc-file-manager.md`](./rfc-file-manager.md)
> - [`file-arch-problems-response.md`](./file-arch-problems-response.md)
>
> ****

---

v1  52  IPC44 File + 2 Fs + 1 Open_Path + 5 App v2  FileManager 

## 

### 

Renderer  `read`  entry  main process  entry DB + FS  FS

** + handler **FileManager  lifecycle service  IPC handler handler  target 

- `FileEntryId` → FileManager entry : resolve → DB + FS
- `FilePath` → ops.ts  FS/

**Tradeoff**`canWrite``resolvePath`  entry + FS FileManager  entry  IPC  handler  thin routing public  FileEntryId path  public API lifecycle service

```
Renderer
  → FileManager.registerIpcHandlers() (, handler )
    ├── target: FileEntryId → this.read / this.write / ... (entry )
    └── target: FilePath    → ops.read / ops.write / ... ()
```

**Main process ** service  ops.ts  FileManager IPC

## 

- ****v1 → v2  v1  `deleteFile` v2  `permanentDelete` `trash` trash
- **handler **Renderer  File IPC handler  `FileEntryId` / `FilePath`  FileManager  ops.ts
- ** file/dir **v1  `move` / `moveDir` 
- **Renderer **service  renderer 
- **FileManager public API  FileEntryId** handler  ops.ts FileManager 

## v1  v2 



- ✅ 
- 🔀 
- ❌ 
- ❓ 

### A.  / 

| v1         |                                     | v2      |                                                                                                                                                       |
| -------------- | --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select`       |  FileMetadata[] | 🔀 `select` |  `selectFolder`  `directory`  FileMetadata `createEntry`  `string \| null` `string[]` |
| `selectFolder` |           | 🔀 `select` |  `select({ directory: true })`                                                                                                                      |
| `open`         |  + <2GB       | ❌          |  `select` + `read` renderer                                                                                                             |
| `save`         |  +                | ✅ `save`   | `showSaveDialog`  `showOpenDialog`                                                                                                            |

**v1 **

```typescript
select(options?: OpenDialogOptions): Promise<FileMetadata[] | null>
selectFolder(options?: OpenDialogOptions): Promise<string | null>
open(options?: OpenDialogOptions): Promise<{ content: string; metadata: FileMetadata } | null>
save(path: string, content: string | NodeJS.ArrayBufferView, options?: any): Promise<string>
```

**v2 **

```typescript
// 
select(options: { directory?: never; multiple?: false; filters?: FileFilter[]; title?: string }): Promise<string | null>
// 
select(options: { directory?: never; multiple: true; filters?: FileFilter[]; title?: string }): Promise<string[]>
// 
select(options: { directory: true; title?: string }): Promise<string | null>
// 
save(options: { content: string | Uint8Array; defaultPath?: string; filters?: FileFilter[] }): Promise<string | null>
```

> **v1 ** `select`/`selectFolder`/`save`  options 
> `filters``properties` `multiple`/`directory``title`v2 

### B.  storage + 

| v1                |                                    | v2                  |                                 |
| --------------------- | -------------------------------------- | ----------------------- | ----------------------------------- |
| `upload`              |  storageMD5  | 🔀 `createEntry`        | `content: FilePath`                 |
| `saveBase64Image`     | base64  →  storage             | 🔀 `createEntry`        | `content: Base64String`             |
| `savePastedImage`     | Uint8Array →  storage    | 🔀 `createEntry`        | `content: Uint8Array`               |
| `download`            |  URL  →  storage             | 🔀 `createEntry`        | `content: URLString`main  |
| `batchUploadMarkdown` |  .md                 | 🔀 `batchCreateEntries` |  markdown       |

**v1 **

```typescript
upload(file: FileMetadata): Promise<FileMetadata>
saveBase64Image(data: string): Promise<FileMetadata>
savePastedImage(imageData: Uint8Array, extension?: string): Promise<FileMetadata>
download(url: string, isUseContentType?: boolean): Promise<FileMetadata>
batchUploadMarkdown(filePaths: string[], targetPath: string): Promise<{ fileCount: number; folderCount: number; skippedFiles: string[] }>
```

**v2 **

```typescript
type FilePath = `/${string}` | `${string}:${string}` | `file://${string}`
type Base64String = `data:${string};base64,${string}`
type URLString = `http://${string}` | `https://${string}`
type FileContent = FilePath | Base64String | URLString | Uint8Array

type CreateEntryParams =
  | { type: 'file'; parentId: FileEntryId; name: string; content: FileContent }
  | { type: 'dir'; parentId: FileEntryId; name: string }

createEntry(params: CreateEntryParams): Promise<FileEntry>
// 
batchCreateEntries(params: { parentId: FileEntryId; items: Array<{ name: string; content: FileContent }> }): Promise<BatchOperationResult>
```

> **v1 **`upload` `select`  `getPathForFile`
> `saveBase64Image`  AI base64`savePastedImage` Uint8Array
> `download`  AI URL`savePastedImage` Uint8Array
> v2  `createEntry({ parentId: 'mount_temp', content: uint8Array })` 
> `batchUploadMarkdown`  `NotesService.ts`
>  +  `NotesPage`  `fileCount === 0` 
>  `BatchOperationResult.succeeded.length === 0` `folderCount`
>  `skippedFiles` markdown  `NotesPage` 
> `skippedFiles`  renderer  `batchCreateEntries` 
>  `FileContent` 

### C.  storage 

| v1         |                                        | v2           |                                          |
| -------------- | ------------------------------------------ | ---------------- | -------------------------------------------- |
| `read`         |  fileId  doc/pdf/xlsx  | 🔀 `read`        | `FileEntryId \| FilePath`  |
| `readExternal` |                            | 🔀 `read`        |  `read` `FilePath`                 |
| `get`          |  FileMetadata                    | 🔀 `getMetadata` | v2  `getMetadata`                      |
| `base64Image`  |  fileId  base64                  | 🔀 `read`        | `encoding: 'base64'`                     |
| `binaryImage`  |  fileId  Buffer                  | 🔀 `read`        | `encoding: 'binary'`                     |
| `base64File`   |  fileId  base64                  | 🔀 `read`        | `encoding: 'base64'`                     |
| `pdfInfo`      |  fileId  PDF                       | 🔀 `getMetadata` | `PdfMetadata.pageCount`                      |

**v1 **

```typescript
read(fileId: string, detectEncoding?: boolean): Promise<string>
readExternal(filePath: string, detectEncoding?: boolean): Promise<string>
get(filePath: string): Promise<FileMetadata | null>
base64Image(fileId: string): Promise<{ mime: string; base64: string; data: string }>
binaryImage(fileId: string): Promise<{ data: Buffer; mime: string }>
base64File(fileId: string): Promise<{ data: string; mime: string }>
pdfInfo(fileId: string): Promise<number>
```

**v2 **

```typescript
// ─── read:  ───

// 
// service 
// #14062 —  LLM API  base64 payload
//  sharp API 
type ImageTransform = {
  maxDimension?: number
  quality?: number
  format?: string
}

// text
read(target: FileEntryId | FilePath, options?: { encoding?: 'text'; detectEncoding?: boolean }): Promise<string>
// base64
read(target: FileEntryId | FilePath, options: { encoding: 'base64'; imageTransform?: ImageTransform }): Promise<{ data: string; mime: string }>
// binary
read(target: FileEntryId | FilePath, options: { encoding: 'binary'; imageTransform?: ImageTransform }): Promise<{ data: Uint8Array; mime: string }>

// ─── getMetadata:  ───
type MetadataBase = { size: number; createdAt: number; modifiedAt: number }

// kind = 'file' | 'directory'
type DirectoryMetadata = MetadataBase & { kind: 'directory' }
type FileMetadataCommon = MetadataBase & { kind: 'file'; mime: string }

//  filetype = 'image' | 'pdf' | 'text' | 'other'
type ImageFileMetadata = FileMetadataCommon & { type: 'image'; width: number; height: number }
type PdfFileMetadata = FileMetadataCommon & { type: 'pdf'; pageCount: number }
type TextFileMetadata = FileMetadataCommon & { type: 'text'; encoding: string }
type GenericFileMetadata = FileMetadataCommon & { type: 'other' }

type FileKindMetadata = ImageFileMetadata | PdfFileMetadata | TextFileMetadata | GenericFileMetadata
type FileMetadata = DirectoryMetadata | FileKindMetadata

getMetadata(target: FileEntryId | FilePath): Promise<FileMetadata>
```

> **v1 **
>
> - `read` `file.id + file.ext`  `"abc123.pdf"``'custom-minapps.json'`
>   v2  `FileEntryId`  ext `FilePath`
> - `readExternal`v2 `FilePath` 
> - `get` `FileMetadata`  UI PasteServiceTranslatePagev2 `getMetadata` 
> - `base64Image` / `binaryImage` / `base64File` `file.id + file.ext`v2  `FileEntryId`
>    `imageTransform` #14062AI 
>   `sharp` service  `imageTransform` 
> - `pdfInfo`renderer ****`getMetadata`  `PdfMetadata.pageCount` 

### D. 

| v1               |                       | v2                         |                                             |
| -------------------- | ------------------------- | ------------------------------ | ----------------------------------------------- |
| `delete`             |  fileId  storage  | 🔀 `trash` / `permanentDelete` |  FileEntryId  file/dir          |
| `deleteDir`          |  ID  storage      | 🔀 `trash` / `permanentDelete` | renderer                            |
| `deleteExternalFile` |             | 🔀 `permanentDelete`           |  service  mount type  |
| `deleteExternalDir`  |             | 🔀 `permanentDelete`           |                                             |
| `clear`              |  storage      | ❌                             | renderer                            |

**v1 **

```typescript
delete(fileId: string): Promise<void>
deleteDir(dirPath: string): Promise<void>
deleteExternalFile(filePath: string): Promise<void>
deleteExternalDir(dirPath: string): Promise<void>
clear(spanContext?: SpanContext): Promise<void>
```

**v2 **

```typescript
trash(params: { id: FileEntryId }): Promise<void>
restore(params: { id: FileEntryId }): Promise<FileEntry>
permanentDelete(params: { id: FileEntryId }): Promise<void>
batchTrash(params: { ids: FileEntryId[] }): Promise<BatchOperationResult>
batchRestore(params: { ids: FileEntryId[] }): Promise<BatchOperationResult>
batchPermanentDelete(params: { ids: FileEntryId[] }): Promise<BatchOperationResult>
```

> **v1 **
>
> - `delete``useKnowledge.ts`  `FileManager.ts`  `file.name`  `id + ext`v2  `FileEntryId`
> - `deleteDir`renderer 
> - `deleteExternalFile`/`deleteExternalDir` `NotesService.ts`  `entry.externalPath`v2  `permanentDelete(entryId)`
> - `clear`renderer  preload/ipc.ts 

### E.  / 

| v1      |                        | v2    |                                 |
| ----------- | -------------------------- | --------- | ----------------------------------- |
| `move`      |              | 🔀 `move` |  FileEntryId file/dir |
| `moveDir`   |              | 🔀 `move` |                                 |
| `rename`    |  .md | 🔀 `move` | rename =  move + newName      |
| `renameDir` |            | 🔀 `move` |                                 |

**v1 **

```typescript
move(path: string, newPath: string): Promise<void>
moveDir(dirPath: string, newDirPath: string): Promise<void>
rename(path: string, newName: string): Promise<void>
renameDir(dirPath: string, newName: string): Promise<void>
```

**v2 **

```typescript
// move + rename newName 
move(params: { id: FileEntryId; targetParentId: FileEntryId; newName?: string }): Promise<FileEntry>
batchMove(params: { ids: FileEntryId[]; targetParentId: FileEntryId }): Promise<BatchOperationResult>
```

> **v1 **
>
> - `move`/`moveDir` `NotesPage.tsx`  `entry.type`  `externalPath`v2  `move(entryId, targetParentId)`
> - `rename`/`renameDir` `NotesService.ts`  `isFile`  `externalPath` + `safeName`v2  `move(entryId, parentId, newName)`

### F.  FS 

| v1           |                            | v2           |                                                    |
| ---------------- | ------------------------------ | ---------------- | ------------------------------------------------------ |
| `write`          |  bytes/string    | ✅ `write`       |  |
| `writeWithId`    |  fileId  storage         | 🔀 `write`       |  `write` FileEntryId  FilePath             |
| `mkdir`          |                        | 🔀 `createEntry` | v2  `createEntry({ type: 'dir' })`           |
| `copy`           |  storage       | ✅ `copy`        |              |
| `createTempFile` |  | ❌               |  `createEntry({ content: Uint8Array })`  |

**v1 **

```typescript
write(filePath: string, data: Uint8Array | string): Promise<void>
writeWithId(id: string, content: string): Promise<void>
mkdir(dirPath: string): Promise<string>
copy(fileId: string, destPath: string): Promise<void>
createTempFile(fileName: string): Promise<string>
```

**v2 **

```typescript
// 
write(target: FileEntryId | FilePath, data: string | Uint8Array): Promise<void>
//  + 
copy(params: { id: FileEntryId; targetParentId: FileEntryId; newName?: string }): Promise<FileEntry>
// 
copy(params: { id: FileEntryId; destPath: FilePath }): Promise<void>
```

> **v1 **
>
> - `write`PasteServicev2  `createEntry` NotesService/NotesPageexport.ts markdownexportExcel.ts ExcelHtmlArtifactsCard HTML `write`
> - `writeWithId` minapps `custom-minapps.json`v2  `write(FileEntryId | FilePath, ...)`
> - `mkdir` NotesService v2  `createEntry({ type: 'dir' })`
> - `copy`renderer 
> - `createTempFile` `createEntry({ parentId: 'mount_temp', content })` 
>    FileRef`sourceType: 'temp_session'`
>   `mount_temp` ref  ref +  ref + move
>    ref ref  +  ref
>    ref 
>   HTML  `write`  temp 

### G.  / 

| v1                   |                                      | v2                 |                                                                                   |
| ------------------------ | ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `isTextFile`             |                          | 🔀 `getMetadata`       | `metadata.type === 'text'`                                            |
| `isDirectory`            |                              | 🔀 `getMetadata`       |  `entry.type` `getMetadata`                                     |
| `checkFileName`          | sanitize+  | ❌ ()              | sanitize  shared  IPC `createEntry`/`move`  |
| `validateNotesDirectory` |                        | ✅ `validateNotesPath` | notes app  `Data/files/notes/`                              |

**v1 **

```typescript
isTextFile(filePath: string): Promise<boolean>
isDirectory(filePath: string): Promise<boolean>
checkFileName(dirPath: string, fileName: string, isFile: boolean): Promise<{ safeName: string; exists: boolean }>
validateNotesDirectory(dirPath: string): Promise<boolean>
```

**v2 **

```typescript
//  C 
getMetadata(target: FileEntryId | FilePath): Promise<FileMetadata>
//  notes 
// notes app  Data/files/notes/ mount 
validateNotesPath(dirPath: FilePath): Promise<boolean>
```

> **v1 **
>
> - `isTextFile``utils/file.ts`  `AttachmentPreview.tsx` v2  `getMetadata(path).type === 'text'` 
> - `isDirectory` `SkillsSettings.tsx` v2  `getMetadata(path)` 
> - `checkFileName` `NotesService.ts`/`NotesPage.tsx` 4 /v2  `createEntry`/`move`  service renderer 
> - `validateNotesDirectory``NotesService.ts`/`NotesSettings.tsx` v2  `validateNotesPath`
>   `filesDir`/`appDataPath`"app  `Data/files/notes/`"
>    mount basePath`managed/``temp/` 
>   | `validateNotesDirectory` |  | ❓ | |

### H. 

| v1                     |                                         | v2            |                                                               |
| -------------------------- | ------------------------------------------- | ----------------- | ----------------------------------------------------------------- |
| `openPath`                 | /                 | ✅ `open`         |  `FileEntryId \| FilePath`service resolve           |
| `openFileWithRelativePath` |  storage                  | 🔀 `open`         | v2  FileEntryId                                           |
| `showInFolder`             |                           | ✅ `showInFolder` |  `FileEntryId \| FilePath`                                    |
| `getPathForFile`           | `webUtils.getPathForFile`preload  | ✅            |  IPC contextBridge  FileManager |

**v1 **

```typescript
openPath(path: string): Promise<void>
openFileWithRelativePath(file: FileMetadata): Promise<void>
showInFolder(path: string): Promise<void>
getPathForFile(file: File): string
```

**v2 **

```typescript
// /
open(target: FileEntryId | FilePath): Promise<void>
// 
showInFolder(target: FileEntryId | FilePath): Promise<void>
//  preload utils FileManager IPC
// getPathForFile(file: File): string
```

> **v1 **
>
> - `openPath`agent v2 `open`  `FilePath` 
> - `openFileWithRelativePath`/ `FileMetadata` storage v2  `FileEntryId`service resolve 
> - `showInFolder` `ClickableFilePath.tsx` v2  `FileEntryId | FilePath`
> - `getPathForFile`PasteServicepreload  `webUtils`

### I. 

| v1                  |                  | v2             |                                                      |
| ----------------------- | -------------------- | ------------------ | -------------------------------------------------------- |
| `getDirectoryStructure` |        | ❌                 | v2  DataApi children         |
| `listDirectory`         | ripgrep  | ✅ `listDirectory` | agent  |

**v1 **

```typescript
getDirectoryStructure(dirPath: string): Promise<NotesTreeNode[]>
listDirectory(dirPath: string, options?: DirectoryListOptions): Promise<string[]>
```

**v2 **

```typescript
// 
listDirectory(dirPath: FilePath, options?: DirectoryListOptions): Promise<string[]>  // DirectoryListOptions 
```

> **v1 **
>
> - `getDirectoryStructure` Notes v2  `GET /files/entries/:id/children` 
> - `listDirectory` `useResourcePanel.tsx`  agent  + optionsv2 

### J. File Watcher

| v1              |                    | v2  |                                                                  |
| ------------------- | ---------------------- | ------- | -------------------------------------------------------------------- |
| `startFileWatcher`  |  chokidar      | ❌      | v2  FileManager service  `local_external` mount  watcher |
| `stopFileWatcher`   |                | ❌      | service  mount                             |
| `pauseFileWatcher`  |  | ❌      | service                                    |
| `resumeFileWatcher` |                | ❌      |                                                                  |
| `onFileChange`      | renderer   | ❌      | v2 renderer  DataApi  FS         |

**v1 **

```typescript
startFileWatcher(dirPath: string, config?: any): Promise<void>
stopFileWatcher(): Promise<void>
pauseFileWatcher(): Promise<void>
resumeFileWatcher(): Promise<void>
onFileChange(callback: (data: FileChangeEvent) => void): () => void
```

**v2 **

Watcher  FileManager service  IPC

> **v1 **
>
> -  Notes `NotesPage.tsx``NotesService.ts`
> - v2 `local_external` mount  watcher  FileManager service 
>   FS  → service  DB → renderer  DataApi 
> -  pause/resume  service renderer 

## v2 FileManager IPC 

v1 44  → v2 19  1  preload 

### 

```typescript
type FilePath = `/${string}` | `${string}:${string}` | `file://${string}`;
type Base64String = `data:${string};base64,${string}`;
type URLString = `http://${string}` | `https://${string}`;
type FileContent = FilePath | Base64String | URLString | Uint8Array;

type CreateEntryParams =
  | { type: "file"; parentId: FileEntryId; name: string; content: FileContent }
  | { type: "dir"; parentId: FileEntryId; name: string };

type MetadataBase = { size: number; createdAt: number; modifiedAt: number };
type DirectoryMetadata = MetadataBase & { kind: "directory" };
type FileMetadataCommon = MetadataBase & { kind: "file"; mime: string };
type ImageFileMetadata = FileMetadataCommon & {
  type: "image";
  width: number;
  height: number;
};
type PdfFileMetadata = FileMetadataCommon & { type: "pdf"; pageCount: number };
type TextFileMetadata = FileMetadataCommon & { type: "text"; encoding: string };
type GenericFileMetadata = FileMetadataCommon & { type: "other" };
type FileKindMetadata =
  | ImageFileMetadata
  | PdfFileMetadata
  | TextFileMetadata
  | GenericFileMetadata;
type FileMetadata = DirectoryMetadata | FileKindMetadata;

type BatchOperationResult = {
  succeeded: FileEntryId[];
  failed: Array<{ id: FileEntryId; error: string }>;
};

// #14062 sharp API
type ImageTransform = {
  maxDimension?: number;
  quality?: number;
  format?: string;
};
```

### 

```typescript
// ─── A.  /  ───
select(options: { directory?: never; multiple?: false; filters?: FileFilter[]; title?: string }): Promise<string | null>
select(options: { directory?: never; multiple: true; filters?: FileFilter[]; title?: string }): Promise<string[]>
select(options: { directory: true; title?: string }): Promise<string | null>
save(options: { content: string | Uint8Array; defaultPath?: string; filters?: FileFilter[] }): Promise<string | null>

// ─── B.  ───
createEntry(params: CreateEntryParams): Promise<FileEntry>
batchCreateEntries(params: { parentId: FileEntryId; items: Array<{ name: string; content: FileContent }> }): Promise<BatchOperationResult>

// ─── C.  /  ───
read(target: FileEntryId | FilePath, options?: { encoding?: 'text'; detectEncoding?: boolean }): Promise<string>
read(target: FileEntryId | FilePath, options: { encoding: 'base64'; imageTransform?: ImageTransform }): Promise<{ data: string; mime: string }>
read(target: FileEntryId | FilePath, options: { encoding: 'binary'; imageTransform?: ImageTransform }): Promise<{ data: Uint8Array; mime: string }>
getMetadata(target: FileEntryId | FilePath): Promise<FileMetadata>

// ─── D.  ───
trash(params: { id: FileEntryId }): Promise<void>
restore(params: { id: FileEntryId }): Promise<FileEntry>
permanentDelete(params: { id: FileEntryId }): Promise<void>
batchTrash(params: { ids: FileEntryId[] }): Promise<BatchOperationResult>
batchRestore(params: { ids: FileEntryId[] }): Promise<BatchOperationResult>
batchPermanentDelete(params: { ids: FileEntryId[] }): Promise<BatchOperationResult>

// ─── E.  ───
move(params: { id: FileEntryId; targetParentId: FileEntryId; newName?: string }): Promise<FileEntry>
batchMove(params: { ids: FileEntryId[]; targetParentId: FileEntryId }): Promise<BatchOperationResult>

// ─── F.  /  ───
write(target: FileEntryId | FilePath, data: string | Uint8Array): Promise<void>
copy(params: { id: FileEntryId; targetParentId: FileEntryId; newName?: string }): Promise<FileEntry>
copy(params: { id: FileEntryId; destPath: FilePath }): Promise<void>

// ─── G.  /  ───
validateNotesPath(dirPath: FilePath): Promise<boolean>
canWrite(dirPath: FilePath): Promise<boolean>
resolvePath(filePath: string): Promise<string>
isPathInside(childPath: string, parentPath: string): Promise<boolean>
isNotEmptyDir(dirPath: FilePath): Promise<boolean>

// ─── H.  ───
open(target: FileEntryId | FilePath): Promise<void>
showInFolder(target: FileEntryId | FilePath): Promise<void>

// ─── I.  ───
listDirectory(dirPath: FilePath, options?: DirectoryListOptions): Promise<string[]>  // 
```

> ** FileManager IPC **
>
> - `getPathForFile(file: File): string` — preload  contextBridge  FileManager
> - File Watcherstart/stop/pause/resume/onFileChange— v2  FileManager service  IPC
> - `getDirectoryStructure` — v2  DataApi `GET /files/entries/:id/children` 
> - `checkFileName` — sanitize  shared  service 

###  File\_  IPC

v1  IPC

####  File Module IPC

| v1 IPC                   | v1                                     | v2                                    |                                     |
| ------------------------ | ------------------------------------------ | ----------------------------------------- | --------------------------------------- |
| `Fs_Read`                | `FileService.readFile`                     | 🔀 `read(FilePath)`                       | → ops.read FilePath   |
| `Fs_ReadText`            | `FileService.readTextFileWithAutoEncoding` | 🔀 `read(FilePath, { encoding: 'text' })` |                                     |
| `Open_Path`              | `shell.openPath(path)`                     | 🔀 `open(FilePath)`                       |  `File_OpenPath` → ops.open |
| `App_HasWritePermission` | `hasWritePermission(filePath)`             | 🔀 `canWrite(FilePath)`                   | → ops.canWrite                          |
| `App_ResolvePath`        | `path.resolve(untildify(filePath))`        | 🔀 `resolvePath(FilePath)`                | → ops.resolvePath                       |
| `App_IsPathInside`       | `isPathInside(childPath, parentPath)`      | 🔀 `isPathInside(child, parent)`          | → ops.isPathInside                      |
| `App_IsNotEmptyDir`      | `fs.readdirSync(path).length > 0`          | 🔀 `isNotEmptyDir(FilePath)`              | → ops.isNotEmptyDir                     |

> **v1 **
>
> - `Fs_Read`aiCore  renderer URL v2 `read(FilePath)` 
> - `Fs_ReadText`renderer v2 `read(FilePath, { encoding: 'text', detectEncoding: true })` 
> - `Open_Path` `File_OpenPath`  `shell.openPath`v2  `open(FilePath)`
> - `App_HasWritePermission``validateNotesPath` 
> - `App_ResolvePath` / `App_IsPathInside` FS I/Orenderer  `node:path` IPC
> - `App_IsNotEmptyDir` ops

####  File Module

| v1 IPC            | v1                                                      | v2          |                                                  |
| ----------------- | ----------------------------------------------------------- | --------------- | ---------------------------------------------------- |
| `Pdf_ExtractText` | `extractPdfText(data: Uint8Array \| ArrayBuffer \| string)` | ✅      |  buffer entry  |
####  FileManager

| v1 IPC                                                           |                                          | v2        |
| ---------------------------------------------------------------- | -------------------------------------------- | ------------- |
| `Open_Website`                                                   | `shell.openExternal(url)` — URL  | App         |
| `FileService_Upload/List/Delete/Retrieve`                        | AI Provider  APIGemini         | Provider  |
| `Gemini_UploadFile/Base64File/RetrieveFile/ListFiles/DeleteFile` | Gemini                           | Provider  |
| `Export_Word`                                                    | Word                                     | Export    |
| `Zip_Compress/Decompress`                                        |                                      | Backup    |
| `Webview_PrintToPDF/SaveAsHTML`                                  | Webview                                  | Webview   |
| `Skill_ReadFile/ListFiles`                                       | Skill                                | Skill     |
