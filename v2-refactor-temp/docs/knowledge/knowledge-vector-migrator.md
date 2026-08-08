# Knowledge Vector Migrator Notes (V2)

## 1. 

 V2 



1. V1 `embedjs` 
2. V2 
3. 
4. 

 retrieval API 



- `src/main/data/migration/v2/migrators/KnowledgeVectorMigrator.ts`
- `src/main/data/migration/v2/migrators/README-KnowledgeVectorMigrator.md`

## 2. 

`KnowledgeVectorMigrator` 

1.  V1  knowledge base  legacy `embedjs` 
2.  chunk  better-sqlite3-backed `vectorstores` 
3.  V2 `knowledge_base` / `knowledge_item`



1. `KnowledgeMigrator` 
2. `KnowledgeVectorMigrator` 

 source of truth  V2 

## 3. 



### 3.1  knowledge base



- SQLite `knowledge_base` 



-  base 
-  embedding `dimensions`
-  base 

### 3.2  knowledge item



- SQLite `knowledge_item` 



-  item 
-  legacy loader identity  `itemId`

### 3.3 Legacy loader metadata



- Redux `knowledge.bases[].items[]`



-  V1 `uniqueId` / `uniqueIds[]`  `knowledge_item.id`
-  item 

### 3.4 Legacy vector database



- `${getDataPath()}/KnowledgeBase/<baseId>`



-  V1 `embedjs`  `vectors` 
-  chunk sourcevector

## 4. 

 `embedjs`  vectorstores 



-  base  runtime  `{knowledgeBaseDir}/{migratedBaseId}/.cherry/index.sqlite` legacy DB 
-  schema `schema.ts`  index store `meta`/`content`/`material`/`search_unit`/`search_text`/`embedding` +  FTS5 `search_text_fts` `openBetterSqlite3IndexDriver` → `createKnowledgeIndexSchema` “1. /2. ” embedjs/langchain  schema 

 schema

1. 
   - `id`
   - `external_id`
   - `collection`
   - `document`
   - `metadata`
   - `embeddings`
2. 
   - `external_id`
   - `collection`
3. FTS 

## 5. 

### 5.1 Loader identity 

V1  `uniqueLoaderId`  loader

V2  `knowledge_item.id`

- `external_id`



1.  legacy item  `uniqueIds[]`
2.  legacy item  `uniqueId`
3.  V2 `knowledge_item`  item 

 V2  item loader identity



1.  V2 `knowledge_item.id`  legacy 
2.  `knowledge_item.id`  legacy  `embedjs` DB 
3. “”“ V2 ”

`directory`V1  item  loader id  per-file item `file`  loader id  `KnowledgeMigrator.expandLegacyDirectoryItem`re-attribute embedding fallback ——legacy —— `directory_not_migrated` 

### 5.2 Chunk 



- `pageContent` -> `document`
- `knowledge_item.id` -> `metadata.itemId`  `external_id`
- `knowledge_item.type` -> `metadata.itemType`
- `source` -> `metadata.source`
- chunk  -> `metadata.chunkIndex`
- chunk  token  -> `metadata.tokenCount`

 metadata
 metadata  runtime `KnowledgeChunkMetadataSchema`
`itemId``itemType``source``chunkIndex``tokenCount` 
 `source`  legacy row  metadata

### 5.3 Embedding 

 embedding

 V1 

1.  legacy `vector`  little-endian float32 BLOB 
2.  `number[]`
3.  `embeddings`



1. 
2. 
3. 

### 5.4 Chunk identity 

 chunk row  `id` 

 UUID v4 `id`

 chunk id

1. `baseId`
2. `external_id` = `knowledge_item.id`
3. chunk  source 

## 6. 

“ +  + v1 ”



1. 
   - `{targetDbPath}.vectorstore.tmp`
2. v1 legacy `embedjs` DB`{knowledgeBaseDir}/{legacyBaseId}`****
   -  base  uuidV2 store  `{migratedBaseId}/.cherry/index.sqlite` legacy flat path 
3.  storeruntime  rename 
   -  unlink  `EBUSY` `recursive` + `maxRetries` + `retryDelay` Windows 
4.  base v1 legacy DB 



1. **** v1  legacy DB ——  v1
2. retry legacy retry  `KnowledgeVectorSourceReader`  legacy DB

## IMPORTANT: 

****“”

1. base 
   -  base `execute()`  `success: false`
   -  `skippedCount` warning 
2.  v1 legacy 
   -  v1  v1 
   - “ v1 ” v1  cleanup 
3. 
   -  knowledge base  v1  DB  V1 
   -  source of truth 

## 7. 



1.  base  prepared row 
2.  `external_id`
3.  `metadata.itemId` `external_id` 

 base 

## 8. 



1. `knowledge_base`  base
2. legacy DB 
3. legacy DB 
4. legacy DB  `vectors` 
5. `uniqueLoaderId`  `knowledge_item.id`
6.  `vector`  `vector` 

 warning



1.  base  legacy  base  V2  vector store
2. “ DB”
3.  V2 `knowledge_item`

## 9. 

“”

1. 
2.  embedding
3.  item
4. 
5.  retrieval service  API



- 
- 

## 10. 

 V2 

1. V2  `knowledge_base` / `knowledge_item`
2.  `external_id`  `knowledge_item.id`
3.  V1 `embedjs`  `uniqueLoaderId`
4.  V2 

## 11. 

- `knowledge-backend-decisions.md`
  -  `KnowledgeRuntimeService`data servicesqueue  runtime/vector 
- `knowledge-schema.md`
  -  V2  schema
- 
  -  V2 



1. schema 
2. backend decisions 
3. vector migrator 

## 12.  Runtime 

 runtime 

- `src/main/services/knowledge/runtime/KnowledgeRuntimeService.ts`
- `src/main/services/knowledge/vectorstore/KnowledgeVectorStoreService.ts`
- `src/main/features/knowledge/vectorstore/indexStore/BetterSqlite3VectorIndex.ts`

 runtime  knowledge base 



1. runtime  `KnowledgeVectorStoreService`  `base.id`  store
2.  store provider  `BetterSqlite3VectorIndex`
3. runtime  better-sqlite3 vector store

 runtime 

1. V2  `knowledge_base` / `knowledge_item`
2.  better-sqlite3-backed vector store 
3.  item  `knowledge_item.id`  V1 loader identity
