# Knowledge V2 

 Knowledge V2 UI 

 UI 

## 1.  RAG 

-  /  renderer  `dimensions`
  -  embedding model 
  - RAG  embedding model  dimensions 
  - `v2-refactor-temp/docs/knowledge/knowledge-ui.md`

-  embedding model  runtime 
  -  embedding provider  Ollama
  -  provider  UI /  provider
  - `v2-refactor-temp/docs/knowledge/knowledge-backend-decisions.md`

-  rerank provider 
  -  rerank  `AiService` ai-core / provider  rerank 
  -  Voyage / TEI  provider provider 
  - `src/main/services/knowledge/utils/indexing/rerank.ts`

-  chunk / RAG  reindex 
  - `chunkSize` / `chunkOverlap`  chunk 
  -  UI  reindex
  - `src/main/data/services/KnowledgeBaseService.ts`

## 2. 

-  `fileProcessorId` 
  -  runtime 
  - OCR /  provider 
  - `v2-refactor-temp/docs/knowledge/knowledge-backend-decisions.md`

-  note 
  -  note 
  -  note picker / note  API UI
  - `src/renderer/pages/knowledge.v2/components/addKnowledgeItemDialog/sources/NoteSourceContent.tsx`

-  `directory`  main runtime 
  - renderer  owner item 
  -  nested directory interrupt / reconcile 
  - `src/renderer/pages/knowledge.v2/plans/add-source-confirm-submit.md`

## 3. UI 

- 
  -  `AttachmentButton`  v2→v1  `KnowledgeRuntime.getFileMetadata` main  legacy `FileMetadata` v2  `FileMetadata` 
  -  `FileMetadata` `FileEntry` / `FileHandle`
  - `src/renderer/pages/home/Inputbar/tools/components/AttachmentButton.tsx``v2-refactor-temp/docs/file-manager/filemetadata-consumer-audit.md`

- 
  -  root items 
  -  item 
  -  UI  /  /  / 
  - `src/renderer/hooks/useKnowledgeItems.ts`

-  `knowledge_v2` 
  -  `zh-cn` / `zh-tw` / `en-us`
  -  locale 
  - `src/renderer/i18n/locales/`

## 4. Runtime 

- ✅  + Phase 4 
  - knowledge.prepare-root / knowledge.index-leaf  `JobManager``jobTable` 
  -  per-base  5 cap 50 base  `KnowledgeRuntimeService.runWithBaseWriteLockForBase` 
  - `recovery: 'retry'` + `JobManager.onAllReady`  60s  startup recovery dispatch  job
  - `src/main/services/knowledge/tasks/prepareRootJobHandler.ts``src/main/services/knowledge/tasks/indexLeafJobHandler.ts`

- 
  - shutdown  fail items startup recovery  dispatchhandler  `item.status === 'completed'` 
  - delete / reindex  list + filter + `jobManager.cancel` vectors  `KnowledgeIndexStore.rebuildMaterial`  chunk
  - 
  - `src/main/services/knowledge/runtime/KnowledgeRuntimeService.ts`

-  base  artifact 
  -  base  SQLite  artifact
  -  artifact 
  -  pending cleanup / 
  - `src/main/services/knowledge/KnowledgeService.ts`

## 5. 

-  V1 
  -  V1 `memory` / `video` item 
  -  item  root
  -  release note 
  - `v2-refactor-temp/docs/knowledge/knowledge-schema.md`

- “”
  -  embedding item
  - v1 legacy  DB 
  -  v1  cleanup 
  - `v2-refactor-temp/docs/knowledge/knowledge-vector-migrator.md`

- 
  - `src/shared/data/types/knowledge.ts`  `FileMetadata`
  -  file domain schema 
  - `src/shared/data/types/knowledge.ts`

## 6. 

- ✅ Knowledge V2  breaking changes `2026-05-20-knowledge-job-auto-recovery.md`
  -  v2  `v2-refactor-temp/docs/breaking-changes/`
  - `v2-refactor-temp/docs/breaking-changes/README.md`

- 
  -  RAG recall stale guardqueue reset/write-lock 
  - 
  - `v2-refactor-temp/docs/knowledge/knowledge-backend-decisions.md`
