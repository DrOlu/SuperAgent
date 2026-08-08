# 

 SuperAgent IPC  UI 

## 

- 
-  `FileMetadata`  Dexie (`db.files`)
- “ +  MD5”
- UI  `db.files` `count` 

## 

-  `getFilesDir()` 
-  `getNotesDir()` 
-  `getTempDir()` 

`src/main/services/FileStorage.ts`

## 

`FileMetadata``src/renderer/types/file.ts`

- `id`:  IDUUID
- `name`:  `uuid + ext`
- `origin_name`: 
- `path`: 
- `size`: 
- `ext`: 
- `type`: image/document/text/...
- `created_at`: 
- `count`: 

Dexie `src/renderer/databases/index.ts``files` 

## FileStorage

`src/main/services/FileStorage.ts`



- /
- 
- //
-  office/pdf 
- Base64/
-  ripgrep
- chokidar

### 

-  MD5
- MD5 `fs.createReadStream`
-  `FileMetadata` `count`

## FileManager

`src/renderer/services/FileManager.ts`



- `uploadFile(s)`:  IPC  `count + 1`
- `addFile(s)`:  `db.files` `count + 1`
- `deleteFile`:  `count > 1`  `db.files` 
- `getFilePath` / `getFileUrl`:  `app.path.files`  `file://` URL
- `formatFileName`:  `origin_name` 

## IPC 

`src/main/ipc.ts``src/preload/preload.ts``window.api.file`



- `File_Select` / `File_Open` / `File_Save`
- `File_Upload` / `File_Delete` / `File_Move` / `File_Rename`
- `File_Read` / `File_ReadExternal`
- `File_Base64Image` / `File_Base64File` / `File_BinaryImage`
- `File_ListDirectory` / `File_GetDirectoryStructure`
- `File_StartWatcher` / `File_StopWatcher`

## UI 

- `src/renderer/pages/files/FilesPage.tsx``FileList.tsx`
  -  `db.files`///
  -  `count`
- 
-  `FileManager.addFiles`  `uploadFiles`  `db.files`

## count

`count` 

- `count > 1` 
- UI 
- /`DexieMessageDataSource.updateFileCount` 

## 

- `origin_name` 
- `name` `origin_name` 
- office/pdf
-  `md/markdown/txt`

## 

- `src/main/services/FileStorage.ts`
- `src/main/ipc.ts`
- `src/preload/preload.ts`
- `src/renderer/services/FileManager.ts`
- `src/renderer/databases/index.ts`
- `src/renderer/pages/files/FilesPage.tsx`
