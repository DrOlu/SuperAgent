# File Processing Unified Job Refactor

## 1. 

 `src/main/services/fileProcessing` 

 Main-side file-processing servicejob  split API 



1. file-processing 
2.  job API
3. artifact 
4. job 
5. processor 
6. 

 UI  Renderer 

---

## 2. 

`file-processing`  Main  / 



1.  PDF / Word  Markdown
2.  OCR 

 `file-processing` 



1. `file-processing`  artifact
2. `KnowledgeService`  service  chunk embedding
3.  OCR 

 `preprocessKnowledgeFile``translateOcr`  `startJob`  Job 

---

## 3. Canonical Terms

|  |  |
| --- | --- |
| File Processing |  /  |
| Processor |  `tesseract``paddleocr``mineru``doc2x` |
| Feature | Processor  `image_to_text`  `document_to_markdown` |
| Capability | Processor  Feature  API  |
| FileProcessingJob |  processor execution `JobManager`  `jobId`  |
| Artifact | job  text  markdown file |
| Provider task |  provider  OCR / Markdown  job id Main  |
| Runtime state | handler  abort controller query contextin-flight query  Main  job  `JobManager` |



1.  `image_to_text`  `translate_ocr`
2.  `document_to_markdown`  `knowledge_preprocess`
3.  `providerTaskId`  provider-specific query context

`document_to_markdown` capability  `maxInputBytes?: number`  `maxInputPages?: number`
 preset override `maxInputBytes` 
`maxInputPages` PDF  file-processing 
 provider  handler 

| Processor | `maxInputBytes` | `maxInputPages` |
| --- | ---: | ---: |
| `paddleocr` | 50 MB | 100 |
| `mineru` | 200 MB | 600 |
| `doc2x` | 1 GB | 1000 |
| `mistral` |  | 1000 |
| `local-document` |  |  handler  300  |
| `open-mineru` | 200 MB |  |

PaddleOCR preset  hosted model `image_to_text`  `PP-OCRv6`
`document_to_markdown`  `PaddleOCR-VL-1.6` capability override  `modelId`

---

## 4. Public Main-side Contract



1. `startJob({ feature, fileEntryId, processorId? }): Promise<JobSnapshot>`
2. job  /  Job DataApi  `jobs.progress.${jobId}` cache
3. cancel  JobManager/job APIFileProcessing  `getJob/cancelJob`

 IPC channel

1. `file-processing:start-job`
2. `file-processing:list-available-processors`

 file-processing IPC 

1. `file-processing:extract-text`
2. `file-processing:start-markdown-conversion-task`
3. `file-processing:get-markdown-conversion-task-result`

 API  facade

### 4.1 startJob

`startJob` 

1. `feature`: `image_to_text`  `document_to_markdown`
2. `fileEntryId`:  FileManager entry id
3. `processorId`:  feature  processor preference

`startJob`  Job snapshot

```ts
type StartFileProcessingJobResult = JobSnapshot
```



1. Main  `jobId`
2.  provider task id
3.  `processorId` feature  processor fail fast
4.  processor  feature fail fast
5.  FileManager metadata  file type  capability  fail fast

### 4.2 Job observation and cancellation

FileProcessing job  JobManager job job snapshot / progress 
 FileProcessing service  provider polling



1. JobManager dispatcher  background / remote-poll handler
2. completed / failed / cancelled  JobManager 
3. pending / delayed / running job cancel  `cancelled`
4.  background execution  abort
5. remote-poll handler 
6.  provider task  best effort

---

## 5. Job State Model

job 

1. `pending`
2. `processing`
3. `completed`
4. `failed`
5. `cancelled`



```ts
type FileProcessingJobBase = {
  jobId: string
  feature: FileProcessorFeature
  processorId: FileProcessorId
  status: FileProcessingJobStatus
  progress: number
}
```



```ts
type FileProcessingJobCompletedResult = FileProcessingJobBase & {
  status: 'completed'
  progress: 100
  artifact: FileProcessingArtifact
}

type FileProcessingJobFailedResult = FileProcessingJobBase & {
  status: 'failed'
  error: string
}

type FileProcessingJobCancelledResult = FileProcessingJobBase & {
  status: 'cancelled'
  reason?: string
}
```



1. `progress`  clamp  0-100 
2. `completed`  artifact
3. `failed`  error
4. `cancelled`  failed
5. provider-specific status 

---

## 6. Artifact Model

job  `artifact`  feature 

 artifact 

```ts
type FileProcessingArtifact =
  | {
      kind: 'text'
      format: 'plain'
      text: string
    }
  | {
      kind: 'file'
      format: 'markdown'
      path: FilePath
    }
```

 feature  artifact 

| Feature | Artifact |
| --- | --- |
| `image_to_text` | `{ kind: 'text', format: 'plain', text }` |
| `document_to_markdown` | `{ kind: 'file', format: 'markdown', path }` |

> **supersedes  FileEntry **file-processing  managed / FileEntry artifact
> caller  markdown`output: { kind: 'path', path }` caller  inline textOCR
> caller `startJob`  `file: FileHandle``{ kind: 'path' }`  `{ kind: 'entry' }`+  `output` markdown  feature  path output text  feature  output
> " FileEntry " markdown  internal FileEntry—— / agent tool path  § `FileManager.createInternalEntry`  internal FileEntry 



1. OCR  text artifact 
2. Markdown  path artifact  caller  caller 
3. artifact 
4.  OCR artifact union provider-specific  job 

---

## 7. Service 



1. `FileProcessingService`
   -  service
   -  IPC handler  JobManager handler
   -  payload Zod 
   -  processor config file metadata
   -  `JobManager.enqueue`  job job store
2. JobManager file-processing handlers
   - `tasks/backgroundJobHandler.ts`  /  capability
   - `tasks/remotePollJobHandler.ts`  start / poll capability
   - handler  `recovery: 'retry'`
   - remote-poll handler  job metadata  provider task state
   -  artifact
3. Processor 
   -  processor 
   -  capability feature  handler
   -  provider task id 
   -  knowledge preprocess service  OCR facade
4. Processor-owned runtime 
   -  processor 
   -  workeridle releasestop / destroy cleanup  processor-owned runtime state
   -  `tesseract`  lifecycle runtime

`JobManager` / SQLite job table  job  source of truth

`FileProcessingService`  job  provider 

### 7.1 Processor-first 

`fileProcessing`  processor  `ocr` / `markdown` feature 



```text
src/main/services/fileProcessing/
  config/
  persistence/
  processors/
    registry.ts
    types.ts
    tesseract/
      index.ts
      types.ts
      image-to-text/
        handler.ts
        prepare.ts
        __tests__/
      runtime/
        TesseractRuntimeService.ts
        types.ts
        __tests__/
    paddleocr/
      index.ts
      types.ts
      utils.ts
      image-to-text/
        handler.ts
      document-to-markdown/
        handler.ts
    mineru/
      document-to-markdown/
        handler.ts
    doc2x/
      document-to-markdown/
        handler.ts
    mistral/
      image-to-text/
        handler.ts
    system/
      image-to-text/
        handler.ts
    ovocr/
      image-to-text/
        handler.ts
    open-mineru/
      document-to-markdown/
        handler.ts
  tasks/
  utils/
```



1. processor  processor id `tesseract``paddleocr``open-mineru`
2. feature  kebab-case `image-to-text``document-to-markdown`
3. shared feature enum  `image_to_text` / `document_to_markdown` kebab-case 
4.  processor  feature  processor  `processors/paddleocr/types.ts``processors/paddleocr/utils.ts`
5.  processor  helper  file-processing  `utils/`
6.  `ocr/``markdown/``runtime/services/` 

### 7.2 Processor Registry

processor handler  registry 

 shape

```ts
processorRegistry[processorId].capabilities[feature]
```



1. registry  processor  map
2.  Electron / Vite 
3.  processor map  feature map  source of truth
4.  `PRESETS_FILE_PROCESSORS`  capability  registry handler 
   - preset  capabilityregistry  handler
   - registry  preset  capability
5. `FileProcessingService` / job execution helper  processor config  registry  capability handler

### 7.3 Capability Handler Contract

processor module  job service  capability handler `OcrProvider` / `MarkdownProvider` 

handler  discriminated execution mode

1. `mode: 'background'`
2. `mode: 'remote-poll'`

handler 

1. `prepare(file, config, signal?)`
   -  provider-specific fail-fast 
   -  processor options / capability config
   -  prepared context
2. background handler
   - `execute(context, executionContext)`
   -  OCR API  job  processor
3. remote-poll handler
   - `startRemote(context)`
   - `pollRemote(remoteContext)`
   -  start / query  processor



1. `prepare`  job recordjob record  `JobManager.enqueue` 
2. `prepare`  `startJob`  fail fast path API keyprocessor option file type 
3. provider task idquery contextremote context  Main  job record
4. handler  IPC resultjob service  artifact
5. capability handler  job  processor-owned runtime service

---

## 8. Execution Model

 job API  processor 

Job service 

1. background execution
2. remote poll

### 8.1 background execution

 OCR API  processor  job 



1. `tesseract`  OCR
2. `system`  OCR
3. `ovocr`  OCR
4. `mistral`  OCR
5. `open-mineru`  Main 



1. `startJob`  `JobManager.enqueue`  job record 
2. JobManager dispatcher  capability handler
3. handler  file-processing task helper  artifact
4. handler  job  `failed`
5. caller cancel  service stop  abort

### 8.2 remote poll

 processor “ + ”



1. `mineru`
2. `paddleocr` 
3. `doc2x`



1. `startJob`  `jobId`
2. handler `startRemote`  provider task id  query context
3. remote-poll handler  provider task id  job metadata
4.  `jobId`  Job API 
5. JobManager dispatcher  job record / progress
6.  artifact job  `failed` job

### 8.3 OCR job 

 OCR  `FileProcessingJob`



1.  OCR  await  start/query
2. Renderer  job polling



1. OCR  Markdown 
2. 
3.  OCR provider 

---

## 9. Progress Observation

File-processing  job event bus



1. job snapshot  Job API 
2. job progress  JobManager  `jobs.progress.${jobId}` cache
3. `FileProcessingService`  Renderer IPC
4.  Renderer  UI job center

 UI  JobManager progress  job bridge file-processing 

---

## 10. Data Ownership

file-processing 

1. Processor preset
   -  `src/shared/data/presets/file-processing.ts`
   -  shared metadata
   -  DataApi / Cache / Preference 
2.  processor  override
   -  Preference
   - 
     - `feature.file_processing.default_document_to_markdown`
     - `feature.file_processing.default_image_to_text`
     - `feature.file_processing.overrides`
3. job 
   - job record  JobManager / SQLite job table
   - remote-poll  provider task state  job metadata
   - API keytokenabort controllerin-flight querybackground execution  handler 
   -  file-processing DataApi endpoint Cache / SharedCache
4.  file artifact
   -  markdown 
   -  `FileManager.createInternalEntry`  internal FileEntry
   -  completed job artifact  `fileEntryId`

DataApi 

1. file-processing job  JobManager job table
2. job state  runtime coordination state DataApi-backed business data
3.  file-processing DataApi endpoint

Cache 

1.  shared cache job mirror
2.  job progress  Cache
3. 

---

## 11. Job Recovery And Retention

file-processing job  JobManager 



1. completed / failed / cancelled  job  JobManager 
2. background handler  `recovery: 'retry'` attempt
3. remote-poll handler  `recovery: 'retry'` job metadata  provider task id  query state
4. API keytokenabort controllerin-flight querybackground execution  metadata
5.  `remoteState.providerTaskId`  provider capability 

 artifact  job artifact  feature 

---

## 12. Input Validation

`FileProcessingService` / job service 



1. IPC payload  Zod schema 
2. `feature`  `FILE_PROCESSOR_FEATURES` 
3. `processorId`  `FILE_PROCESSOR_IDS` 
4. `file`  `FileMetadataSchema`
5. processor  feature
6. `file.type`  capability `inputs`
   - `image_to_text`  `image`
   - `document_to_markdown`  `document`
7. `document_to_markdown` capability  `maxInputBytes`job execution  provider `prepare`  live `FileInfo.size` `size >= maxInputBytes` 
8. PDF capability  `maxInputPages` URL  `pageCount > maxInputPages` 
9. PDF  job  provider Main i18n

 facade 

1. PDFDOCXPNGJPG 
2.  capability `maxInputBytes` / `maxInputPages`  provider 
3. provider  API key / api host / path 
4. 

 provider  failed job  startJob fail-fast

---

## 13. Processor Boundary

file-processing processor  `src/main/services/fileProcessing/processors` 



1.  `loadOcrImage`
2.  SDK / 
3. shared preset / preference 
4. `application.getPath(...)`
5. processor-owned lifecycle runtime service `processors/tesseract/runtime/TesseractRuntimeService`



1.  knowledge preprocess service
2.  `src/main/services/ocr` facade
3. Renderer store / Redux / Dexie / ElectronStore
4. processor-specific  lifecycle runtime service 

Processor handler  IPC  job service  artifact

Processor  secretAPI keytoken 

### 13.1 Runtime Ownership Criteria

`runtime`  provider utils  processor  lifecycle  processor-owned runtime

 runtime

1.  workerprocesspoolconnection 
2.  lifecycle `onStop` / `onDestroy` 
3.  idle release
4.  job 
5. job  `AbortSignal` 



1. `tesseract`
   -  runtime service
   -  `tesseract.js` workerlanguage-key worker reuseidle release  lifecycle cleanup
2. `ovocr`
   -  runtime service
   -  child process execution `processors/ovocr/image-to-text` 
   -  processor  process management
3. `open-mineru`
   -  runtime service
   -  HTTP service Cherry  /  OpenMinerU 
4. `mineru``doc2x``paddleocr``mistral`
   -  runtime service
   -  API processor
5. `system`
   -  runtime service
   -  OCR API

 `ProcessManagerService`  `ProcessRunner`



1. Tesseract workerOV OCR scriptOpenMinerU HTTP call  runtime
2. 
3.  file-processing 
4.  / utility process processor process lifecycle  processor  ProcessManager

### 13.2 Tesseract Runtime Boundary

`TesseractRuntimeService`  `processors/tesseract/runtime/` runtime-level API

 public input

```ts
type TesseractRuntimeInput = {
  file: ImageFileMetadata
  langs: LanguageCode[]
  signal?: AbortSignal
}
```



1. `processors/tesseract/image-to-text/prepare.ts`  `FileProcessorMerged`  langs  options
2. `TesseractRuntimeService`  `FileProcessorMerged` import image-to-text handler  private types
3. `TesseractRuntimeService`  `loadOcrImage` worker 
4. runtime 
   -  shared worker
   -  langs key 
   - `PQueue` concurrency 1
   - idle release
   - stop / destroy  abort pending work  terminate worker
5.  language worker pool  per-task worker

---

## 14. Result Persistence

Markdown conversion  artifact  Main 



1.  markdown  zip /
2. markdown  `FileManager.createInternalEntry({ source: 'bytes', ext: 'md' })`  internal FileEntry
3. job output  processed artifact  `fileEntryId`
4. zip  markdown entry entry path  zip slip
5.  zip  `application.getPath('feature.file_processing.temp')` 

OCR text artifact 

 text artifact  size threshold  file artifact fallback

---

## 15. Lifecycle



1. `FileProcessingService` service IPC handler
2. `processors/tesseract/runtime/TesseractRuntimeService` service worker idle release
3. file-processing task handlers JobManager handler lifecycle service
4. processor helper / pure utility direct-import singleton lifecycle 



1. `FileProcessingService`  `FileManager`  `JobManager`
2. `FileProcessingService.onInit`  file-processing JobManager handlers
3. Tesseract image-to-text handler  `application.get('TesseractRuntimeService')`  runtime
4.  BeforeReady  cross-phase `@DependsOn`Preference  BeforeReady  lifecycle 



1. `FileProcessingService`  lifecycle  IPC handler
2. Job cancel / retry / timeout  JobManager 
3.  processor runtime  lifecycle service 

---

## 16. Legacy And Scope

 file-processing 

1.  Renderer 
2.  `window.api.ocr`
3.  `src/main/services/ocr`
4.  OCR IPC  job API
5.  UI job center
6.  file-processing DataApi job table



1.  file-processing job API
2.  OCR renderer/main 
3.  preprocess provider 

 file-processing API 

 PR 

1. Renderer / preload  `startJob`  Job /
2.  OCR  `window.api.ocr`  file-processing job
3.  OCR service  preprocess provider
4.  i18n migration 

---

## 17. Feature Rename Implementation Notes

 feature  I/O 

| Old | New | Handler name | Directory |
| --- | --- | --- | --- |
| `text_extraction` | `image_to_text` | `imageToText` | `image-to-text/` |
| `markdown_conversion` | `document_to_markdown` | `documentToMarkdown` | `document-to-markdown/` |



1. `text_extraction`  PDF Word 
2. `image_to_text`  image text OCR  feature 
3. `document_to_markdown`  document markdown conversion 
4.  feature  I/O 



1. `src/shared/data/preference/preferenceTypes.ts`
   - `FILE_PROCESSOR_FEATURES`  `['image_to_text', 'document_to_markdown']`
2. `src/shared/data/presets/file-processing.ts`
   - capability schema  literal  literal
   - preset capability  `feature` 
   - capability override schema key  feature key  feature key
3. preference schema / default preference keys
   -  processor key  `feature.file_processing.default_image_to_text`
   -  processor key  `feature.file_processing.default_document_to_markdown`
   - `feature.file_processing.overrides`  capability override key  feature 
4. `v2-refactor-temp/tools/data-classify/data/classification.json`
   -  key data-classify toolchain  preference schema  mapping
5. v2 migration mappings / tests
   -  file-processing override merge  feature 
   -  default processor mapping  target key
   - 
6. file-processing service / processor code
   - resolverregistryjob payload schemacapability handlertests  feature 



1.  preference key  preference key  runtime fallback
2.  service  feature  alias
3.  override  `text_extraction` / `markdown_conversion` capability key
4. migration / data-classify  schema  key v2 
5.  v2  schema drift

---

## 18. Testing Baseline

 / schema 

1. `startJob` payload 
2.  Job snapshot / progress 
3.  job cancel 
4. `FileProcessingJobOutput` artifact schema
5. `FileProcessingArtifact` discriminated union

Job service 

1.  `image_to_text` job  text artifact
2.  `document_to_markdown` job  markdown file artifact
3. remote-poll job  dedupe
4. background job progress 
5. provider  failed
6. cancel pending / processing job  cancelled
7. cancel completed job  completed
8.  processor  fail fast
9. processor  feature  fail fast
10. file type  capability inputs  fail fast
11. background handler  capability
12. remote-poll handler  metadata  provider task state
13. PDF  PDF
14.  remote-poll task  PDF  task 

Registry 

1.  preset capability  registry handler
2. registry  preset  capability
3. `processorRegistry[processorId].capabilities[feature]`  job service  processor + feature 

Persistence 

1. markdown content  internal FileEntry  `fileEntryId` artifact
2. zip result  markdown entry  internal FileEntry
3. unsafe zip entry 
4. zip 

Processor 

1. processor-specific schema / request / result parsing 
2. processor feature handler  job store 
3. job service 
4. processor-specific  `processors/tesseract/runtime/__tests__``processors/paddleocr/image-to-text/__tests__`
5. Tesseract runtime  lifecycle phaseworker reusequeued workstop / destroy cleanupidle releasestop  job



1. `pnpm lint`
2. `pnpm test`
3. `pnpm format`

---

## 19. Accepted Trade-offs

 job API 

1.  OCR  start/query
2.  await helper
3.  `extractText -> { text }` 



1. OCR  Markdown 
2.  OCR provider 
3. 

 artifact 

1.  inspect `artifact.kind`  `artifact.format`
2. 



1.  artifact 
2.  job result  feature-specific 
3. OCR Markdown 

JobManager-backed job 

1. file-processing  JobManager  retry / retention 
2.  job progress 



1.  job state  runtime coordination state file-processing  business data
2.  artifact 
3.  file-processing job store  DataApi / Cache  source of truth

---

## 20. Review Baseline





1.  `FileProcessingJob` API
2.  /  file-processing
3.  provider task id  query context
4.  artifact 
5. 
6.  job state  JobManager file-processing  store
7.  job progress  Renderer broadcast 

 blocker 

1. Renderer  job API
2.  OCR service 
3. facade 
