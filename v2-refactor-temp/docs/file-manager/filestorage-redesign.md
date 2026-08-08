# FileStorage Redesign

> **⚠️ OUTDATED / SUPERSEDED2026-04-21**
>
> "🔀 FileManager.createEntry"
>
> - `FileManager.createEntry({origin, content, ...})` →  `createInternalEntry` discriminated union+ `ensureExternalEntry` upsert by path
> - External entry  trash `fe_external_no_delete` CHECK
> - `permanentDelete`  external  DB 
>
> ****[`docs/references/file/file-manager-architecture.md`](../../../docs/references/file/file-manager-architecture.md)[`rfc-file-manager.md`](./rfc-file-manager.md)[`file-arch-problems-response.md`](./file-arch-problems-response.md)
>
>  v1 FileStorage God Object  ops.ts / FileManager / ** v2 API **

---

v1  `FileStorage.ts`  ~78  God Object FS CRUDDialogShell v2 

## 

```
ops.ts (, sole fs owner)
  └──  filePath

FileManager ( lifecycle service)
  ├── IPC handler 
  ├── entry ops: entryId → filePath resolve + DB  +  fs 
  ├── Electron dialog
  └── chokidar  ()

FileTreeService (data repository,  DB)
FileRefService (data repository,  DB)
```

## FS 

** ops.ts ops.ts  `import node:fs` ** chokidar  FileManager  sync  stat/read  ops.ts re-export  ops.ts //

## 

- ✅ 
- 🔀 
- ❌ 
- ❓ 

---

## A. FS CRUD

| v1                     |                                  | v2                                |                                               |
| -------------------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------- |
| `uploadFile`               |  storage | 🔀 FileManager.createEntry            | resolve parentId →  ops.copy +  |
| `deleteFile`               |  fileId                    | 🔀 FileManager.permanentDelete        | resolve path → ops.delete + DB        |
| `deleteDir`                |  dirId                 | 🔀 FileManager.permanentDelete        | CASCADE                           |
| `deleteExternalFile`       |                    | 🔀 ops.delete                         |                                         |
| `deleteExternalDir`        |                | 🔀 ops.deleteDir                      |                                         |
| `moveFile`                 | /                      | 🔀 ops.move                           |                                         |
| `moveDir`                  | /                      | 🔀 ops.move                           |                                         |
| `renameFile`               |  .md               | 🔀 ops.move                           |                       |
| `renameDir`                |                            | 🔀 ops.move                           |                                         |
| `copyFile`                 |  fileId              | 🔀 FileManager.copy({ id, destPath }) | resolve id → path + ops.copy              |
| `writeFile`                |                          | ✅ ops.write                          |                                         |
| `writeFileWithId`          |  fileId                      | 🔀 FileManager.write                  | resolve path → ops.write                  |
| `mkdir`                    |                              | ✅ ops.mkdir                          |                                         |
| `clear`                    |  storage                 | ❌                                    |                         |
| `clearTemp`                |                          | 🔀 FileManager.clearTemp              |  mount_temp  +              |
| `batchUploadMarkdownFiles` |  md                      | 🔀 FileManager.batchCreateEntries     |  ipc-redesign                           |

## B. 

| v1                     |                                                          | v2                                                                              |                                                                 |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `compressImage`            | >1MB  sharp                                | ✅ ops.ts `compressImage`                                                           | FileManager  createEntry                            |
| `compressImageBuffer`      |  buffer                                        | 🔀 ops.ts `compressImage`                                                           |  compressImage buffer                               |
| `saveBase64Image`          | base64  →  UUID →  storage →  metadata       | 🔀 FileManager.createEntry({ type: 'file', parentId, name, content: Base64String }) |  data URL →  ext → ops.write                        |
| `savePastedImage`          |  Uint8Array →  UUID →  storage →  metadata | 🔀 FileManager.createEntry({ type: 'file', parentId, name, content: Uint8Array })   |  → ops.write                                    |
| `downloadFile`             | URL  →  UUID →  storage →  metadata          | 🔀 FileManager.createEntry({ type: 'file', parentId, name, content: URLString })    |  PaintingsAI ops.download → ops.write |
| `getExtensionFromMimeType` | MIME →                                             | ✅ ops.mimeToExt                                                                    |                                                           |

## C. 

| v1                       |                                                  | v2                             |                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `getFile`                    |                    | 🔀 ops.stat + getFileType          |  ipc-redesign  getMetadatamain                                                                         |
| `getFileType`                |  + fallback  buffer  | ✅ ops.getFileType                 | ext → FileType fallbackisBinaryFile + chardet fs                                         |
| `getFileHash`                |  MD5 hash                                        | ✅ ops.hash                        | fileEntryTable  hash createEntry                                                                               |
| `findDuplicateFile`          |  size+hash                             | 🔀 FileManager.createEntry     | v1  O(n) → v2  DB  entry +  FileRef                                      |
| `pdfPageCount`               | PDF pdf-lib                                  | 🔀 ops.getMetadata                 |  ipc-redesign                                                                                                                    |
| `isTextFile` / `_isTextFile` | chardet + isbinaryfile           | ✅ ops.isTextFile                  |                                                                                                                                  |
| `isDirectory`                |                                          | ✅ ops.stat                        |                                                                                                                                  |
| `fileNameGuard`              |  +                           | ❌ ()                          | sanitize → shared  → createEntry / copy / move  parentId OS  name  ext |
| `getFilePathById`            | fileId →                                     | 🔀 FileManager.resolvePhysicalPath | entryId →                                                                                                              |

## D. 

| v1             |                                       | v2                    |                                                                                                                                                |
| ------------------ | ----------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readFileCore`     | .doc/office/text  | 🔀 ops.read               | private v1  IPC event v2 ops.read word-extractor / officeParser /  |
| `readFile`         |  fileId                           | 🔀 FileManager → ops.read |  resolve + delegate                                                                                                                          |
| `readExternalFile` |                           | 🔀 ops.read               |                                                                                                                                          |
| `base64Image`      |  fileId  base64                 | 🔀 FileManager → ops.read | encoding: 'base64'                                                                                                                             |
| `binaryImage`      |  fileId  Buffer                 | 🔀 FileManager → ops.read | encoding: 'binary'                                                                                                                             |
| `base64File`       |  fileId  base64                 | 🔀 FileManager → ops.read | encoding: 'base64'                                                                                                                             |

## E. DialogElectron 

| v1         |                 | v2                |                                |
| -------------- | ------------------- | --------------------- | ---------------------------------- |
| `selectFile`   |   | 🔀 FileManager.select |  ipc-redesign            |
| `open`         |  +  | ❌                    |  select + read             |
| `save`         |  +    | ✅ FileManager.save   |  ipc-redesign            |
| `saveImage`    |       | 🔀 FileManager.save   |  save                        |
| `selectFolder` |     | 🔀 FileManager.select |  select({ directory: true }) |

## F. Shell

| v1                     |                | v2                    |                     |
| -------------------------- | ------------------ | ------------------------- | ----------------------- |
| `openPath`                 |  | ✅ ops.open               |               |
| `openFileWithRelativePath` |      | 🔀 FileManager → ops.open |  resolve  |
| `showInFolder`             |  | ✅ ops.showInFolder       |               |

## G. ripgrep + 

 `listDirectory`  private v2  `ops/search.ts` `listDirectory` 

| v1                     |                       | v2                |     |
| -------------------------- | ------------------------- | --------------------- | ------- |
| `getRipgrepBinaryPath`     |  ripgrep        | 🔀 ops/search.ts  | private |
| `executeRipgrep`           |  ripgrep          | 🔀 ops/search.ts  | private |
| `searchByFilename`         |               | 🔀 ops/search.ts  | private |
| `searchDirectories`        |               | 🔀 ops/search.ts  | private |
| `listDirectoryWithRipgrep` | ripgrep  +  | 🔀 ops/search.ts  | private |
| `isFuzzyMatch`             |               | 🔀 ops/search.ts  | private |
| `isGreedySubstringMatch`   |               | 🔀 ops/search.ts  | private |
| `getFuzzyMatchScore`       |               | 🔀 ops/search.ts  | private |
| `getGreedyMatchScore`      |               | 🔀 ops/search.ts  | private |
| `queryToGlobPattern`       |  glob           | 🔀 ops/search.ts  | private |
| `buildRipgrepBaseArgs`     |  ripgrep          | 🔀 ops/search.ts  | private |

## H. 

| v1                   |                          | v2                   |                                                                                                                 |
| ------------------------ | ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `listDirectory`          |  | ✅ ops.listDirectory     |                                                                                                           |
| `getDirectoryStructure`  |            | ❌                       | v2  DataApi children Notes  UI isStarred / expanded  Notes  FileEntry  VO |
| `validateNotesDirectory` |                | ✅ ops.validateNotesPath |                                                                                                           |

## I. chokidar

| v1                |                | v2                |            |
| --------------------- | ------------------ | --------------------- | -------------- |
| `startFileWatcher`    |  chokidar  | 🔀 ExternalSyncEngine |  |
| `stopFileWatcher`     |            | 🔀 ExternalSyncEngine |                |
| `pauseFileWatcher`    |            | 🔀 ExternalSyncEngine |                |
| `resumeFileWatcher`   |            | 🔀 ExternalSyncEngine |                |
| `getWatcherStatus`    |        | 🔀 ExternalSyncEngine |                |
| `createChangeHandler` |      | 🔀 ExternalSyncEngine |                |
| `shouldWatchFile`     |  | 🔀 ExternalSyncEngine |                |
| `notifyChange`        |  renderer      | 🔀 ExternalSyncEngine |                |
| `handleWatcherError`  |            | 🔀 ExternalSyncEngine |                |
| `cleanup`             |            | 🔀 ExternalSyncEngine |                |

## J. 

| v1             |                     | v2           |                                  |
| ------------------ | ----------------------- | ---------------- | ------------------------------------ |
| `constructor`      |  storage      | 🔀               |  service  onInit |
| `initStorageDir`   |  storage/notes  | 🔀 ops.ensureDir |                            |
| `tempDir` (getter) |         | 🔀 FileManager   | mount_temp basePath                  |

---

## ❓



### 1. compressImage / compressImageBuffer

v1  upload  >1MB 

****ops.ts  `compressImage(path, options)` FileManager  createEntry 

### 2. URL downloadFile

v1  URL  storage

****ops.ts  `download(url, destPath)` FileManager  createEntrycontent: URLString

### 3.  hash / getFileHash / findDuplicateFile

**** hashv1  O(n) → v2  fileEntryTable  hash MD5

- `contentHash` = md5(content) — 
- `fullHash` = md5(content + name + ext) —  + 



- ****name →  `contentHash` →  entry entry
- ****name →  `fullHash` →  entry entry

 FileManager v1  `uploadFile`  metadatav2 

### 4. fileNameGuard

****sanitize → shared  IPC → createEntry / copy / move  parentId OS  name  ext

### 5. Office readFileCore

**** Aops/fs.ts  `read` word-extractor / officeParser / chardet readFileCore  v1  IPC event  private v2 ops.read 

### 6. getDirectoryStructure

****v2  DataApi `GET /files/entries/:id/children` Notes  UI isStarred / expanded  Notes  FileEntry  VO

### 7. ripgrep 11  private 

**** ops/search.ts  `listDirectory`  `listDirectory`  private
