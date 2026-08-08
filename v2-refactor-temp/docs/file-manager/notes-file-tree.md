# 



## 

-  `window.api.getAppInfo().notesPath`
- `notesPath`  Redux`store/note` `useNotesSettings` 
- main  `getNotesDir()` 

## 

-  `loadTree(notesPath)` 
- `loadTree`  `window.api.file.getDirectoryStructure` 
- `sortTree` A-Z
- `mergeTreeState`  `starredPaths`  `expandedPaths` 



- `src/renderer/pages/notes/NotesPage.tsx`
- `src/renderer/services/NotesService.ts`
- `src/renderer/services/NotesTreeService.ts`

## 

-  `window.api.file.startFileWatcher(notesPath)` 
-  main  `FileStorage`  chokidar watcher
-  tree refresh starred/expanded 

## 

- `addDir` -> `window.api.file.mkdir`
- `addNote` -> `window.api.file.write` `.md`
- `delNode` -> `deleteExternalFile` / `deleteExternalDir`
- `renameNode` -> `file.rename` / `file.renameDir`

 `db.files`

## 

 Markdown `.md`, `.markdown`



-  -> `useNotesFileUpload` 
- `uploadNotes`  main 
  - `window.api.file.batchUploadMarkdown(filePaths, targetPath)`
  -  watcher
-  File API renderer `uploadNotesLegacy`

## 

- `window.api.file.write(targetPath, content)`
- 

## 

-  `db.files`
- `/files` `db.files` 

## 

-  watcher
-  `db.files` 
