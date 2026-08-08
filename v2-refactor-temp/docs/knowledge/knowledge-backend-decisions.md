# 

 `src/main/services/knowledge`  workflow 

`v2-refactor-temp`  canonical 

- [Knowledge Service](../../../docs/references/knowledge/knowledge-service.md)
- [Knowledge Workflow Architecture](../../../docs/references/knowledge/workflow-architecture.md)
- [Knowledge Operation Guards](../../../docs/references/knowledge/operation-guards.md)

 `src/main/knowledge` / `knowledge-base:*` 

## 1. 

```text
UI / preload IPC / main-side workflow
  -> KnowledgeService
     -> KnowledgeWorkflowService
        -> JobManager
           -> knowledge.prepare-root
           -> knowledge.index-documents
           -> knowledge.delete-subtree
           -> knowledge.reindex-subtree
              -> KnowledgeLockManager
                 -> KnowledgeBaseService / KnowledgeItemService
                 -> KnowledgeVectorStoreService / FileManager

UI Data API reads / patch
  -> Data API knowledge handlers
     -> KnowledgeBaseService / KnowledgeItemService
```

 `KnowledgeRuntimeService` Knowledge  in-memory queueretrytimeoutcancel  startup recovery  `JobManager` 

## 2. 

`KnowledgeBaseService` / `KnowledgeItemService`

1.  SQLite 
2.  `knowledge_item.status` / `error` 
3.  `knowledge_item.data`  `type` 
4.  container item 
5.  readerembeddingJobManager  caller-facing IPC

Data API knowledge handlers

1.  base metadata/config 
2.  runtime mutation vector store artifacts

`KnowledgeService`

1.  caller-facing `knowledge-runtime:*` IPC
2.  create/delete/restore base workflow
3.  Knowledge JobManager handlers
4.  `KnowledgeWorkflowService`  `KnowledgeLockManager`
5.  delete / reindex / chunk  guard
6.  reader / chunk / embed / vector write

`KnowledgeWorkflowService`

1.  `addItems` / `deleteItems` / `reindexItems`  workflow 
2.  `scheduleItem(baseId, itemId)`
3.  `directory`  `knowledge.prepare-root`
4.  `file` / `note` / `url`  `knowledge.index-documents`
5.  add/reindex 

`KnowledgeLockManager`

1.  base  mutation 
2.  vector replace/deleteFileRef cleanupitem status writes  destructive cleanup/reset
3.  `DbService.withWriteTx` SQLite  `DbService.withWriteTx`

## 3. 

UI / preload 

```text
UI
 |
 +--> Data API
 |     -> list/get knowledge bases
 |     -> patch base metadata/config
 |     -> list/get knowledge items
 |
 \--> preload knowledgeRuntime IPC
       -> create/delete/restore base
       -> add/delete/reindex items
       -> search
       -> list/delete chunks
```

 file / url / note / directory 

```text
caller
 -> preload IPC add-items(item payloads)
```

 Data API  item created item ids  runtime `addItems`

Leaf item 

```text
add-items(leaf payloads)
 -> create leaf item rows
 -> status = processing
 -> enqueue knowledge.index-documents
```

Container item 

```text
add-items(directory payloads)
 -> create root item rows
 -> status = preparing
 -> enqueue knowledge.prepare-root
 -> prepare-root expands owner
 -> prepare-root creates child rows
 -> workflowService.scheduleItem(child)
```

`prepare-root`  child  `directory` workflow service  `knowledge.prepare-root` reader  leaf indexing 

## 4. JobManager 

 Knowledge job types

1. `knowledge.prepare-root`
2. `knowledge.index-documents`
3. `knowledge.delete-subtree`
4. `knowledge.reindex-subtree`

 base 

```text
base.${baseId}
```

JobManager 

1. job 
2. dispatch
3. retry / timeout
4. cancel
5. startup recovery

Knowledge  `entries` map`controller``runPromise``interruptError`  in-memory queue 

## 5. 

`knowledge.index-documents` 

```text
handler.execute
 -> load base and item
 -> skip missing / deleting / already completed item
 -> under base mutation lock:
      rebuild source file refs
      status = reading
 -> read documents
 -> chunk documents
 -> under base mutation lock:
      status = embedding
 -> embed chunks
 -> under base mutation lock:
      re-read item
      skip vector write if item is deleting
      vectorStore.replaceByExternalId(itemId, nodes)
      status = completed
```

 reader  documents chunk  chunks`index-documents`  `replaceByExternalId(itemId, [])`  item  chunks item  `completed`

 JobManager retryRetry  job cancel handler `onSettled`  item  `failed` item  `deleting` 

## 6. Delete / Reindex 

`delete-items` 

```text
delete-items(baseId, itemIds)
 -> collapse to top-level roots
 -> under base mutation lock:
      mark selected root subtrees deleting
 -> enqueue knowledge.delete-subtree
```

`knowledge.delete-subtree`

```text
 -> resolve still-deleting subtree
 -> cancel active jobs touching subtree
 -> under base mutation lock:
      delete vectors for leaf items
      clear Knowledge FileRef rows for full subtree
      delete knowledge_item rows
```

`file_ref.sourceId`  polymorphic FK  `knowledge_item` hard delete  subtree  Knowledge FileRef rows root id  refs  descendant orphan refs

`reindex-items` 

```text
reindex-items(baseId, itemIds)
 -> collapse to top-level roots
 -> reject unless every selected subtree item is completed or failed
 -> enqueue knowledge.reindex-subtree
```

`knowledge.reindex-subtree`

```text
 -> skip if delete already marked any subtree item deleting
 -> under base mutation lock:
      re-check deleting guard
      delete old vectors
      delete expanded descendants for selected container roots
      reset selected roots to preparing / processing
 -> workflowService.scheduleItem(root)
```

Reindex  cancellation primitiveActive subtree  delete reindex

## 7. `knowledge_item.status` 

 `status` 

1. `idle`
2. `preparing`
3. `processing`
4. `reading`
5. `embedding`
6. `completed`
7. `failed`
8. `deleting`

 `phase` `status`  JobManager progress 



1. `preparing``directory`  expand / create children
2. `processing`leaf  reading container  active children
3. `reading`leaf  source documents
4. `embedding`leaf  embedding
5. `completed`leaf indexing  container  active children
6. `failed`index/preparation/scheduling compensation 
7. `deleting` cleanup

## 8. Base workflow

`createBase(dto)` 

```text
IPC create-base(CreateKnowledgeBaseDto)
 -> KnowledgeBaseService.create(dto)
 -> KnowledgeVectorStoreService.createStore(base)
 -> return created base
```

 vector store orchestration  `KnowledgeBaseService.delete(base.id)`  SQLite base

`deleteBase(baseId)` 

```text
IPC delete-base(baseId)
 -> cancel active Knowledge jobs in base queue
 -> under base mutation lock:
      KnowledgeVectorStoreService.deleteStore(baseId)
      KnowledgeBaseService.delete(baseId)
```

Artifact  SQLite  UI SQLite  artifacts orchestration  `invalidOperation`

`restoreBase(dto)` 

```text
IPC restore-base(sourceBaseId, embeddingModelId, dimensions)
 -> load source base
 -> load source root items
 -> create new base with source config and requested embedding contract
 -> add source root item payloads to restored base
```

Restore  failed base completed base completed source base  `embeddingModelId`  `dimensions`  clone/rebuild

## 9. Search / Chunk 

`search(baseId, query)` 

1.  failed base
2.  searchable token  query
3.  base embedding model  query embedding
4.  sqlite-vec vector store
5.  missing / other-base / deleting source item 
6.  rerank model rerank
7.  `scoreKind = relevance`  relevance thresholdBM25 / hybrid  ranking  threshold  rank

`list-item-chunks` / `delete-item-chunk` 

1.  failed base
2.  item  `completed`
3.  completed `directory` list  subtree  `deleting` descendant

## 10. 

1.  `KnowledgeRuntimeService`
2.  Knowledge  in-memory queue
3.  `index-leaf` job type leaf indexing job  `knowledge.index-documents`
4.  `phase` 
5.  restore same embedding config  no-op 
6.  permanent-delete detached `FileEntry` rows
7. Round 1  FileProcessing`knowledge_base.fileProcessorId`  indexing inert

## 11. 

1.  canonical  canonical 
2.  `v2-refactor-temp`  canonical docs 
3.  RFC “”“”
