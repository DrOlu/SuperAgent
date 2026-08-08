# `utils/file/` legacyFile.ts + fileOperations.ts 

> **** RFC ——**v1  `src/main/utils/file.ts` `legacyFile.ts` `src/main/utils/fileOperations.ts`  v2 `@main/utils/file/*`  phase **
>
> ****RFC [rfc-file-manager.md](./rfc-file-manager.md) [migration-plan.md](./migration-plan.md)  [fs-usage-audit.md](./fs-usage-audit.md) "P0 " phase Phase 1b.1 / 1b.2  PR 
>
> ****Phase 1a  `src/main/utils/file.ts`  `src/main/utils/file/legacyFile.ts` `src/main/utils/file/index.ts`  barrel re-export  `@main/utils/file` `fileOperations.ts`  `src/main/utils/fileOperations.ts` `src/main/utils/file/`

---

## 

Phase 1a 

```
src/main/utils/file/
├── index.ts          # barrelre-export ./legacyFile import 
├── legacyFile.ts     # v1 helpers
├── fs.ts             # v2 read / write / stat / copy / move / remove / removeDir / atomicWriteFile / statVersion / contentHash
├── metadata.ts       # v2 getFileType(path) / isTextFile(path) / mimeToExt(mime)
├── path.ts           # v2 resolvePath / isPathInside / canWrite / isNotEmptyDir / canonicalizeAbsolutePath / resolvePhysicalPath / getExtSuffix
├── search.ts         # v2 listDirectory (ripgrep + fuzzy)
└── shell.ts          # v2 open / showInFolder
```



```
src/shared/file/types/
├── fileType.ts       # getFileType(ext) + fileTypeMap legacyFile migration-plan §A1 
└── filename.ts       # sanitizeFilename / validateFileName main + renderer 
```

FileManager`src/main/services/file/FileManager.ts` entry `createInternalEntry` / `ensureExternalEntry` / `read(entryId, opts)` / `write` / `trash` / `restore` / `permanentDelete` / `rename` / `copy` / `withTempCopy` / …

Notes  `src/main/services/notes/` Notes  Notes 

---

## `legacyFile.ts` 

20 **Callers **  `grep -rln <symbol> src/` `legacyFile.ts`  barrel

### 2.1  path /  → `@main/utils/file/path`

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `resolveAndValidatePath(baseDir, relativePath)` | 2 | `path.ts` |  | **1b.1** | `path.ts`  canonicalizeAbsolutePath  |
| `untildify(pathWithTilde)` | 2 | `path.ts` |  | **1b.1** | `~`  string op FS |
| `isPathInside(childPath, parentPath)` | 9 | `path.ts` |  | **1b.1** |  `path.ts`  §7 callers  API  |

****Phase 1b.1  `path.ts`  `canonicalizeAbsolutePath` / `isPathInside`  `path.ts``legacyFile.ts`  `export { ... } from './path'`  re-export  9  `isPathInside` caller Phase 2  re-export

### 2.2  /  → `@main/utils/file/path`

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `hasWritePermission(dir)` | 5 | `path.ts` | `canWrite(path): Promise<boolean>` | **1b.1** |  §7  `canWrite`  path.ts  |
| `directoryExists(dirPath)` | 2 | `path.ts` | `isDirectory(path): Promise<boolean>` | **1b.1** | `fs.stat` + `.isDirectory()` |
| `fileExists(filePath)` | 3 | `path.ts` | `isFile(path): Promise<boolean>` | **1b.1** | `fs.stat` + `.isFile()` |
| `pathExists(targetPath)` | 5 | `path.ts` | `exists(path): Promise<boolean>` | **1b.1** | `fs.access(R_OK)` |

**** 2.1Phase 1b.1 `legacyFile.ts`  re-export 

### 2.3  → `src/shared/file/types/fileType.ts` + `@main/utils/file/metadata`

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `getFileType(ext)` | 5 | `src/shared/file/types/fileType.ts`**ext **<br>+ `@main/utils/file/metadata.ts`**path ** | `getFileTypeByExt(ext): FileType`shared<br>`getFileType(path): Promise<FileType>`metadata.ts  `path.extname` shared OTHER  buffer  | **1b.1** |  [migration-plan.md §A1-A3](./migration-plan.md) ext  shared main + renderer v2 `metadata.ts.getFileType(path)`  path ext  shared |
| `getFileExt(filePath)` | 2 | **** |  `path.extname(filePath)` | **2**consumer  |  node:path  callers  |
| `getFileDir(filePath)` | 0 | **** | — | Phase 1a  |  caller`path.dirname`  |
| `getFileName(filePath)` | 0 | **** | — | Phase 1a  |  caller`path.basename`  |

****Phase 1b.1  shared  `fileType.ts``metadata.ts.getFileType(path)` `legacyFile.getFileType(ext)`  `export { getFileTypeByExt as getFileType } from '@shared/file/types/fileType'` `getFileExt`  callers  `path.extname(...)``getFileDir` / `getFileName`  PRPhase 1a 

### 2.4  → `src/shared/file/types/filename.ts`

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `sanitizeFilename(fileName, replacement)` | 6 | `src/shared/file/types/filename.ts` |  | **1b.1** |  string opmain + renderer  shared |
| `validateFileName(fileName, platform)` | 0 | `src/shared/file/types/filename.ts` |  | **1b.1** |  caller `checkName`  |
| `checkName(fileName)` | 1 | `src/shared/file/types/filename.ts` |  | **1b.1** | Notes  shared renderer  |

****Phase 1b.1  shared  `filename.ts``legacyFile.ts`  re-export 

### 2.5 FS  → `@main/utils/file/fs` + FileManager

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `readTextFileWithAutoEncoding(filePath)` | 5 | `@main/utils/file/fs.read(path, { encoding: 'text', detectEncoding: true })` |  `fs.ts` `read` overload | **1b.1** | `fs.read` overload 1 `read(path, { encoding?: 'text', detectEncoding?: boolean })` chardet + iconv-lite  1b.1  `fs.read`  |
| `writeWithLock(filePath, data, options)` | 1 | ** `fs.atomicWriteFile(path, data)` ** | — | **1b.2** | v2  tmp+rename  §5.3fs-usage-audit §-5 caller  1b.2  `atomicWriteFile``legacyFile.writeWithLock`  |
| `base64Image(file: FileMetadata)` | 8 | ** `FileManager.read(entryId, { encoding: 'base64' })` ** | — | **Phase 2**consumer  |  §3.3 `read` IPC  base64 overload  `{ data, mime }``base64Image`  v1 8  callers FileMetadata → FileEntryId |
| `getAllFiles(dirPath)` | 2 | ** `listDirectory` + FileManager ** | — | **Phase 2**consumer  |  v1 `FileMetadata[]`  uuid ——v2  uuid `ensureExternalEntry`  FileEntry `listDirectory(dirPath)`  +  `FileManager.getMetadata` callers  |

****
- `readTextFileWithAutoEncoding`  v2 `fs.read`  overloadPhase 1b.1  `fs.read` `legacyFile`  re-export  Phase 2
- `writeWithLock``base64Image``getAllFiles` ** API ** caller  Phase 1b.2 / Phase 2 

### 2.6 Notes  → `src/main/services/notes/`out of file-module

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `scanDir(dirPath, depth, basePath)` | 1 | `src/main/services/notes/` NotesService  |  NotesService  | **NotesService  phase** |  `NotesTreeNode[]`——Notes RFC §1.3  Notes  file-module  |
| `getName(baseDir, fileName, isFile)` | 5 | `src/main/services/notes/` | Notes  helper | **NotesService  phase** |  `.md`  + —— Notes  filename  |

**** NotesService Phase 1b Phase 2  Notes 

### 2.7 legacyFile.ts 20 

|  |  |  |
|---|---|---|
| `@main/utils/file/path` | 7 | `resolveAndValidatePath` / `untildify` / `isPathInside` / `hasWritePermission`→`canWrite` / `directoryExists`→`isDirectory` / `fileExists`→`isFile` / `pathExists`→`exists` |
| `@main/utils/file/metadata` + shared `fileType.ts` | 1 | `getFileType(ext)`  shared  ext  + metadata.ts  path  |
| shared `filename.ts` | 3 | `sanitizeFilename` / `validateFileName` / `checkName` |
| `@main/utils/file/fs.read` overload | 1 | `readTextFileWithAutoEncoding` |
| ** API ** 1:1  | 3 | `writeWithLock` → `atomicWriteFile``base64Image` → `FileManager.read({encoding:'base64'})``getAllFiles` → `listDirectory` + FileManager  |
| Notes  file-module | 2 | `scanDir` / `getName` |
|  caller  | 3 | `getFileDir` / `getFileName` / `getFileExt` |
| **** | 20 | |

---

## `fileOperations.ts` 

3  caller

|  | Callers |  |  | Phase |  |
|---|---|---|---|---|---|
| `copyDirectoryRecursive(source, destination, opts)` | `SkillInstaller.ts` | `@main/utils/file/fs` | `copyDir(src, dest, opts?): Promise<void>` | **1b.2** |  `allowedBasePath` `MAX_RECURSION_DEPTH=1000` skip symlinkrace-condition ENOENT ——**** `fs.copy(src, dest)` `copy`  overload |
| `deleteDirectoryRecursive(dirPath, opts)` | `SkillInstaller.ts`, `SkillService.ts` | `@main/utils/file/fs` | `removeDir(path, opts?): Promise<void>` | **1b.2** | `fs.ts`  `removeDir`  stub  `allowedBasePath`  |
| `getDirectorySize(dirPath, opts)` | `markdownParser.ts` | `@main/utils/file/metadata` | `getDirectorySize(path, opts?): Promise<number>` | **1b.1  1b.2** |  `lstat + size` `metadata.ts` `fs.ts`**`metadata.ts`**—— `getFileType(path)` "" |

****

1. `allowedBasePath` —— src/dest/delete target 
2. `MAX_RECURSION_DEPTH = 1000`——
3. `lstat`  symlink—— TOCTOU + 
4. `copyFile + chmod` 
5.  `ENOENT` 
6. pipe/socket/device

****Phase 1b.2  `fs.copy` / `fs.removeDir` `fileOperations.ts`  `fs.ts` / `metadata.ts``fileOperations.ts` 3  caller + 2  mock 

###  PR 

 Phase 1b.2 ****`git mv src/main/utils/fileOperations.ts → src/main/utils/file/fileOperations.ts` 5  import3  + 2  mock

- `utils/file/` " helper"`legacyFile.ts` + `fileOperations.ts` 
-  Phase 1a  `legacyFile.ts` 
- Phase 1b.2 " fs.ts / metadata.ts"

---

##  Phase 

### Phase 1a PR

- [x] `git mv src/main/utils/file.ts → src/main/utils/file/legacyFile.ts`
- [x] `src/main/utils/file/index.ts` barrel re-export `./legacyFile`
- [ ] `git mv src/main/utils/fileOperations.ts → src/main/utils/file/fileOperations.ts` 5  import
- [ ]  caller  `getFileDir` / `getFileName`

### Phase 1b.1 runtime

- [ ] `path.ts`  `resolveAndValidatePath` / `untildify` / `isPathInside` / `canWrite` `hasWritePermission`/ `isDirectory` / `isFile` / `exists`
- [ ] `src/shared/file/types/fileType.ts`  `getFileType(ext)` + `fileTypeMap` 5  `getFileType` caller  main  shared
- [ ] `src/shared/file/types/filename.ts`  `sanitizeFilename` / `validateFileName` / `checkName`
- [ ] `metadata.ts`  `getFileType(path)` `path.extname` +  shared  ext OTHER  buffer `chardet` + `isbinaryfile`
- [ ] `fs.ts`  `read`  text overload `detectEncoding: true` `readTextFileWithAutoEncoding`
- [ ] `legacyFile.ts`  re-export `@main/utils/file`  import 
- [ ] `metadata.ts`  `getDirectorySize(path)` 1b.1 

### Phase 1b.2 + 

- [ ] `fs.ts`  `atomicWriteFile` / `atomicWriteIfUnchanged``writeWithLock`  caller  `atomicWriteFile``legacyFile.writeWithLock` 
- [ ] `fs.ts`  `copy(src, dest)` `copyDir(src, dest, opts?)` `allowedBasePath` / `MAX_RECURSION_DEPTH` / symlink skip 
- [ ] `fs.ts`  `remove` / `removeDir(opts?)` `allowedBasePath` 
- [ ] `SkillInstaller.ts` / `SkillService.ts` / `markdownParser.ts`  import  `@main/utils/file/fs` / `@main/utils/file/metadata`
- [ ] `fileOperations.ts` 
- [ ] `metadata.ts`  `getDirectorySize(path)` 1b.1  1b.2 

### Phase 2consumer 

- [ ] `base64Image`  8  caller  `FileManager.read(entryId, { encoding: 'base64' })``legacyFile.base64Image` 
- [ ] `getAllFiles`  2  caller  `listDirectory` FileEntry  `ensureExternalEntry` `legacyFile.getAllFiles` 
- [ ] `getFileExt`  2  caller  `path.extname(...)``legacyFile.getFileExt` 
- [ ] `legacyFile.ts`  re-export `legacyFile.ts` `utils/file/index.ts` barrel "re-export legacy""re-export v2 surface"

### NotesService  phasefile-module 

- [ ] `scanDir` / `getName`  `legacyFile.ts` `src/main/services/notes/`
- [ ] Notes  `checkName`  shared  `filename.ts`

---

## 

### 5.1  `getFileType`  ext  + path 

- **ext **`.md` → `'text'` renderer  /  renderer  IPC 
- **path ** ext  + buffer  ext `FILE_TYPE.OTHER` `isbinaryfile`  `FILE_TYPE.TEXT` main-only  buffer
-  `fileTypeMap`——" overload "

### 5.2  `writeWithLock` 

v2 `requireSingleInstance` v1 v2  `atomicWriteFile`tmp + rename + fsync—— §5.3  [fs-usage-audit §-5](./fs-usage-audit.md) ""

### 5.3  `base64Image` 

-  v1 `FileMetadata`v2  `FileEntryId`
-  `application.getPath('feature.files.data', ...)` —— `resolvePhysicalPath` 
-  `FileManager.read(entryId, { encoding: 'base64' })`  §3.3  overload

### 5.4  `getAllFiles`  1:1 



1. → `listDirectory`
2.  ext → `metadata.getFileType(path)`
3. ** `FileMetadata` `uuidv4()`**

 v1 ——v2  uuid  `createInternalEntry` " uuid" Phase 2 caller ****

- `listDirectory` + `metadata.getFileType`
-  FileEntry `ensureExternalEntry`  upsert file_entry

### 5.5 Notes  out of scope

RFC §1.3 "Notes file treefiles browsed/edited inside the Notes app Notes moduleFS-first FileEntry"`scanDir`  `NotesTreeNode``getName`  `.md` —— Notes  `src/main/services/notes/` 

---

##  reviewer 

1. **`getDirectorySize`  `metadata.ts`  `fs.ts`**
   - metadata.ts "" `getFileType` 
   - fs.ts  + lstat `copyDir` / `removeDir` 
   -  metadata.ts fs.ts
2. **`legacyFile.ts`  re-export **
   - Phase 1b.1  `@deprecated`Phase 2 
   - —— caller rely on periodic grep
   -  reviewer  Phase 1b.1 PR 
3. **Shared `fileType.ts` / `filename.ts` **
   - migration-plan §A1  `src/shared/file/types/fileType.ts`
   -  `src/shared/file/types/`  `handle.ts` / `info.ts` / `ipc.ts`——"/" ""
   - `fileType.ts` enum +  `filename.ts`validate / sanitize  `src/shared/file/utils/` —— `types/` 
   -  migration-plan  `types/`  reviewer  `utils/` 
