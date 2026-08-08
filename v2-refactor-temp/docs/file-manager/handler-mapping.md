# FileManager Handler Mapping

> **⚠️ OUTDATED / SUPERSEDED2026-04-21**
>
> " IPC"`createEntry({origin})` 
>
> - `createEntry({origin:'internal',...})` → `createInternalEntry(...)`
> - `createEntry({origin:'external',...})` → `ensureExternalEntry(...)` upsert by path restore 
> - External entry  trash `permanentDelete`  external  DB 
>
> ****[`docs/references/file/file-manager-architecture.md`](../../../docs/references/file/file-manager-architecture.md)[`rfc-file-manager.md`](./rfc-file-manager.md)[`file-arch-problems-response.md`](./file-arch-problems-response.md)
>
>  v1→v2 handler **** IPC 

---

v1 IPC → v2 IPC  FileManager handler 



- [ipc-redesign.md](./ipc-redesign.md) — v2 IPC  v1 
- [filestorage-redesign.md](./filestorage-redesign.md) — v1 FileStorage ~78  v2 

## 

FileManager  IPC handler handler  target 

```
Renderer
  → FileManager.registerIpcHandlers() ()
    ├── target: FileEntryId → FileManager  (entry : resolve → DB + FS)
    │     ├── ops.ts
    │     ├── FileTreeService (DB)
    │     └── FileRefService (DB)
    └── target: FilePath    → ops.ts ( FS/)
```

FileManager  public  FileEntryId path  handler  ops.ts public API

Main process  service  ops.ts  FileManager IPC

## 

###  Entry  → FileManager

 `FileEntryId` FileManager  DB + FS

| v2 IPC                           |  v1 IPC                                                                                |                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| `createEntry(params)`                | `File_Upload`, `File_SaveBase64Image`, `File_SavePastedImage`, `File_Download`, `File_Mkdir` |  content  ops      |
| `batchCreateEntries(params)`         | `File_BatchUploadMarkdown`                                                                   |                              |
| `trash({ id })`                      | `File_Delete`, `File_DeleteDir`                                                              |                                      |
| `restore({ id })`                    | _(v1 )_                                                                                    |  ensureAncestors                   |
| `permanentDelete({ id })`            | `File_DeleteExternalFile`, `File_DeleteExternalDir`                                          | FS  + DB                     |
| `batchTrash/Restore/PermanentDelete` | _(v1 )_                                                                                    |                              |
| `move(params)`                       | `File_Move`, `File_MoveDir`, `File_Rename`, `File_RenameDir`                                 | FS move + DB update                  |
| `batchMove(params)`                  | _(v1 )_                                                                                    |                              |
| `copy(params)`                       | `File_Copy`                                                                                  |  |

###  Path  → ops.ts

 `FilePath` ops.ts entry 

| v2 IPC                         |  v1 IPC                      |                                        |
| ---------------------------------- | ---------------------------------- | ------------------------------------------ |
| `select(options)`                  | `File_Select`, `File_SelectFolder` | Electron dialog                            |
| `save(options)`                    | `File_Save`, `File_SaveImage`      | Electron dialog + ops.write                |
| `listDirectory(dirPath, options?)` | `File_ListDirectory`               |                                            |
| `validateNotesPath(dirPath)`       | `File_ValidateNotesDirectory`      |                                            |
| `canWrite(dirPath)`                | `App_HasWritePermission`           | ops.canWrite                               |
| `resolvePath(filePath)`            | `App_ResolvePath`                  | ops.resolvePath (path.resolve + untildify) |
| `isPathInside(child, parent)`      | `App_IsPathInside`                 | ops.isPathInside                           |
| `isNotEmptyDir(dirPath)`           | `App_IsNotEmptyDir`                | ops.isNotEmptyDir                          |

###  → handler  target 

 `FileEntryId | FilePath`handler  target 

| v2 IPC               |  v1 IPC                                                                                                         | FileEntryId →            | FilePath →             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------- |
| `read(target, options?)` | `File_Read`, `File_ReadExternal`, `Fs_Read`, `Fs_ReadText`, `File_Base64Image`, `File_BinaryImage`, `File_Base64File` | FileManager.read         | ops.read               |
| `getMetadata(target)`    | `File_Get`, `File_GetPdfInfo`, `File_IsTextFile`, `File_IsDirectory`                                                  | FileManager.getMetadata  | ops.stat + getFileType |
| `write(target, data)`    | `File_Write`, `File_WriteWithId`                                                                                      | FileManager.write        | ops.write              |
| `open(target)`           | `File_OpenPath`, `File_OpenWithRelativePath`, `Open_Path`                                                             | FileManager.open         | ops.open               |
| `showInFolder(target)`   | `File_ShowInFolder`                                                                                                   | FileManager.showInFolder | ops.showInFolder       |

##  v1 IPC

| v1 IPC                                |                                              |
| ------------------------------------- | ------------------------------------------------ |
| `File_Open`                           | renderer  select + read                  |
| `File_Clear`                          |                                          |
| `File_CreateTempFile`                 | → `createEntry({ parentId: 'mount_temp', ... })` |
| `File_CheckFileName`                  | sanitize → shared  → service     |
| `File_GetDirectoryStructure`          | → DataApi `GET /files/entries/:id/children`      |
| `File_StartWatcher/Stop/Pause/Resume` | FileManager  IPC                 |

##  File Module  IPC

| v1 IPC                          | v2        |                                     |
| ------------------------------- | ------------- | --------------------------------------- |
| `getPathForFile`                | preload utils |  IPC                    |
| `Open_Website`                  | App         | `shell.openExternal(url)`               |
| `Pdf_ExtractText`               |       |  buffer |
| `FileService_*`                 | Provider  | AI Provider  API                |
| `Gemini_*File`                  | Provider  | Gemini                              |
| `Export_Word`                   | Export    |                                         |
| `Zip_Compress/Decompress`       | Backup    |                                         |
| `Webview_PrintToPDF/SaveAsHTML` | Webview   |                                         |
| `Skill_ReadFile/ListFiles`      | Skill     |                                         |

---

## 

|                          | v1  | v2                                 |
| ------------------------ | --- | ---------------------------------- |
|  IPC         | 52  | 22                                 |
|  Entry         | —   | 9 → FileManager                    |
|  Path          | —   | 8 → ops.ts                         |
| handler  | —   | 5 → FileManager or ops.ts          |
|                    | —   | 10                                 |
|              | —   | 10                                 |
| v1             | —   | 7 (trash/restore/batch + ) |
