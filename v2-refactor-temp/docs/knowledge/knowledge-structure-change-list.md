# Knowledge 

 Knowledge V2 

 UI 

## 

### 1.  `groupTable` `knowledge_base`  `groupId`

#### 

-  `knowledge_group` 
-  `src/main/data/db/schemas/group.ts`  `groupTable`
-  `knowledge_base`  `groupId`  `groupTable.id`
-  Knowledge `group.entityType` 
  - `knowledge_base`
-  `KnowledgeBaseService`  `entityType` SQLite  `groupId` 

#### 

-  Knowledge V2 
-  renderer  mock 
-  `knowledge_item.groupId`
  - `knowledge_item.groupId`  item /
  - 

#### 

1. SQLite Schema
   - `src/main/data/db/schemas/knowledge.ts`
   -  `knowledgeBaseTable` 
     - `groupId: text().references(() => groupTable.id, { onDelete: 'set null' })`

2. Shared Data Types / API Schema
   - `src/shared/data/types/knowledge.*`
   - `src/shared/data/api/schemas/knowledges.ts`
   -  `KnowledgeBase``CreateKnowledgeBaseDto``UpdateKnowledgeBaseDto`  `groupId`

3. Data Service / Handler 
   - `KnowledgeBaseService`
   - knowledge  handler
   - service  `groupId` / `entityType` 
   - create / update  `groupId`  trim 
   -  SQLite 

4. Migration / 
   -  `groupId`
   -  `null`
   - 

#### 

-  `knowledge_group` 
-  `knowledge_item.groupId` 
- 
-  group 
  -  `icon`
  - `color`
  - `isDefault`
  - `parentId`

#### 

- `knowledge_base` 
- knowledge base DataApi 
-  renderer 

### 2.  `knowledge_base` 

#### 

-  `knowledge_base`  `emoji`  `icon` 
- 
-  UI  DataApi / SQLite 

#### 

-  V2 
- 

#### 

1. SQLite Schema
   - `src/main/data/db/schemas/knowledge.ts`
   - `knowledgeBaseTable`  `emoji` / `icon` 

2. Shared Data Types / API Schema
   - `src/shared/data/types/knowledge.ts`
   - `src/shared/data/api/schemas/knowledges.ts`
   - `KnowledgeBase``CreateKnowledgeBaseDto``UpdateKnowledgeBaseDto` 

3. Data Service / Handler 
   - `KnowledgeBaseService`
   - knowledge  handler
   - 

4. Migration / 
   - V2  `emoji` 

#### 

-  `emoji`
-  `icon`
-  `iconType`
-  `iconUrl`
-  `cover`
-  `separatorRule`

#### 

- `knowledge_base` 
- knowledge base DataApi 
- renderer 

## 

- 
