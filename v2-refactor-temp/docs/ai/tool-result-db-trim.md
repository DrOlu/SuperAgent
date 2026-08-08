#  DB (#16786) FileManager  GC

> :2026-08-02(,)
> `src/main/ai/runtime/aiSdk/params/features/contextBuild.ts``packages/aiCore/src/core/context/*`(vendored)`src/main/services/VfsBlobService.ts``src/main/data/services/MessageService.ts``src/main/services/file/*``src/shared/data/types/message.ts``src/shared/data/types/file.ts`
>  message.data ,blob  VFS  FileManagerGC  TTL 

## 

,VFS ****:`message.data` ,,`vfs_<sha256>.txt`  7 ( 30 )TTL ,

 DB ,`message.data`  head/tail + marker,**blob **:

- TTL  = (UI fs_read );
-  30 ** GC **:blob ,, reaper ,

## 

### 1. :FileManager  + contentHash 

-  `FileManager.createInternalEntry({ source:'bytes', cleanupPolicy:'delete_when_unreferenced' })`, `{userData}/Data/Files/{uuid}.txt`,`contentHash`(xxh3-64)
-  `findInternalByContentHash`(`FileManager.ts:1021`): regenerate/ ——  `vfs_<sha256>` , entry
- vendored `VFSStorageAdapter`(`offloader.ts`),:per-request  `assistantMessageId`,`write` = xxh3 → find-or-create →  provisional ref( §3);filename→entry , `name`( `vfs_<sha256[:16]>`)

### 2. message.data: persisted 

 `truncateThreshold`( 50k ) tool-result, output :

```ts
{ kind: 'persisted-text', fileEntryId, head, tail, totalChars, totalLines }
```

( `src/shared/data/types/message.ts`  tool part output )

- ****: head/tail + , DataApi files read(`data/api/handlers/files.ts`) entry 
- **prompt **:**** `<persisted-output>` marker ( = entry ) → ,
- ****: persisted ();, FileManager , marker  marker  —— turn  prefix bust

### 3. : chat_message_file_ref, role 'tool_output'

- `chatMessageRoles`(`src/shared/data/types/file.ts:465`) `['attachment']`  `['attachment','tool_output']`;`cmfr_role_check` CHECK ****(`pnpm db:migrations:generate`) `persistentFileRefTablesBySourceType`(`fileRelations.ts:189`),
- `extractChatMessageFileEntryIds`(`MessageService.ts:210`) persisted  `fileEntryId` ;`replaceChatMessageFileRefsTx`(`MessageService.ts:237`) role,delete-and-reinsert 
- **()**:`MessageServiceBackend.persistAssistant` , assistant placeholder  turn (`createUserMessageWithPlaceholders`)offload  `tool_output` ref  placeholder, 1h grace  turn  0-ref  reaper ; replace turn  ref  placeholder , —— ,

### 4. GC:

- // → FK  ref (Layer 1/2)→  0-ref → entry-cleanup reaper(30min  tick + 1h grace,`entryCleanup.ts:55`) blob;/ FS (`orphanSweep.ts`)
- **** ref ;
-  `lastUsedAt`

### 5. fs_read: per-request allow-list

blob  `Data/Files`  root(/)context build  marker  entry  `RequestContext`( `fileAttachments` ),`FsReadTool.allowedRoots` ** prompt ** blob, uuid 

### 6. VfsBlobService 

- : FileManager ,temp 7  sweep`feature.context_build.vfs.temp` `getRoot` ,(v1 residue )
- ** — TemporaryChatBackend**: DB ,provisional ref ,FileManager  1h  temp-dir(),fs_read allow-list  VfsBlobService ,

### 7. 

-  fat ****:, ref  turn  placeholder()
- :backfill job(`contentHashBackfillJobHandler` ) persisted  prefix cache bust

### 8. ()

- marker  persisted  → ,
- contentHash  → regenerate/ entry  → ,provider prefix cache ()
- (contextBuild  anthropicCache )
- blob  ==  →  fs_read ****; TTL 

## 

1. **schema/shared**:role  + CHECK ;persisted  → :`pnpm db:migrations:check`schema 
2. **FileManager  + provisional ref**( xxh3 name )→ 
3. ****:finalize  trim + extract/replace refs → MessageService (`setupTestDatabase`)
4. **prompt  persisted  + fs_read allow-list** → contextBuild/FsReadTool 
5. **UI  + breaking-changes **(,)
6. ()backfill job

## (2026-08-02,feat/context-build-truncation)

:①/ streamPrompt ****( head/tail ,VfsBlobService , temp );②,,;③ 30  TTL, GC

/:

- ** marker **:`message.data`  `$persistedToolOutput`(`src/shared/ai/transport/persistedToolOutput.ts`:fileEntryId + vfsFilename + head/tail + counts + shape),prompt  `renderPersistedToolOutputs`(`ai/messages/persistedOutputRendering.ts`, `toModelMessages` ) marker——
- **v1 **: MCP (`shape: 'text' | 'mcp-content'`); JSON (`toModelOutput` ),, `shape:'json'`
- ****:`MessageServiceBackend.persistAssistant`( SQLite ) finalize  await `trimOversizedToolOutputs`;refs  data  part ,
- ****:`createFileManagerStorageAdapter`(`ai/contextBuild/persistedOutputAdapter.ts`)write =  entry + ** provisional `tool_output` ref**  placeholder (1h grace ); = message ( uuid , messageId  FK )
- **fs_read**: per-request  allow-list(`RequestContext.persistedOutputPaths`, + ;realpath , blob  not-found)
- ** G1 **:`copyPathRowsTx`  ref —— `TopicService.duplicate`  source-id map  ref (role ,`tool_output` ); copyPathRowsTx  `(entry, source, role)` 
- ****: `$deferredToolResult` , excerpt, + 

Breaking-changes :`v2-refactor-temp/docs/breaking-changes/2026-08-02-tool-output-excerpt-storage.md`
Backfill : walk `message.data` → `trimOversizedToolOutputs` → `messageService.update`( refs);
