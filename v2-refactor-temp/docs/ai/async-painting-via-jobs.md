#  JobManager

> 2026-05-31
> `src/renderer/aiCore/provider/custom/*`( transport)`src/main/data/services/PaintingService.ts``src/main/core/job/*`
> aiCore  main , Job & Scheduler **,**——

## 

 **JobManager +  `painting.generate` JobHandler**,**** SchedulerService

`docs/references/job-and-scheduler/overview.md` :

- SchedulerService (cron / interval / once,)
- JobManager ( + 6  +  +  + )

****, cron, JobManagerscheduler 

## 

`docs/references/job-and-scheduler/handler-authoring.md`  **§2 "Remote-poll pattern (cross-restart hand-off)"** :submit  vendor →  `providerTaskId` → :

> CRITICAL: await — without persistence the restart-recovery will re-submit the remote job, wasting user quota and producing parallel external tasks.

 transport  1:1 ,****:

- `dashscope/dashscopeTransport.ts`:`submit()`  `{ taskId }`, task id  `onSubmitTaskId?.(taskId)`(`:404`);`poll(taskId, { signal })`(`:408`)
- `ppio/ppioTransport.ts``aihubmix/aihubmixFlux.ts`: `submit → { taskId }` + `poll(taskId)`

`onSubmitTaskId`  task id —— §2  `ctx.patchMetadata({ providerTaskId })`

JobManager (`KnowledgeService``fileProcessing/tasks/*JobHandler`),

## ( main )

1. **JobRegistry** :

   ```ts
   declare module '@main/core/job/jobRegistry' {
     interface JobRegistry {
       'painting.generate': PaintingGeneratePayload
     }
   }
   ```

2. **PaintingService(main,)**: `onInit`  `registerHandler('painting.generate', paintingGenerateJobHandler)`( handler-authoringRegistration timing—— `onInit`, `onAllReady`), IPC( `Painting_Generate`)→  `jobManager.enqueue('painting.generate', payload)`Handler  `src/main/data/services/.../tasks/PaintingGenerateJobHandler.ts`(handler-authoring §6 )

3. **Handler.execute = §2 remote-poll**:

   ```ts
   async execute(ctx) {
     let taskId = ctx.metadata.providerTaskId as string | undefined
     if (!taskId) {
       const r = await transport.submit(input, { signal: ctx.signal })
       if (r.imageUrls) return finalize(r.imageUrls)          //  vendor:, taskId
       taskId = r.taskId!
       await ctx.patchMetadata({ providerTaskId: taskId })     // CRITICAL: poll 
     }
     while (!ctx.signal.aborted) {
       const urls = await transport.poll(taskId, { signal: ctx.signal })
       if (urls.length) return finalize(urls)
       ctx.reportProgress(/* … */)
       await sleep(POLL_INTERVAL_MS, { signal: ctx.signal })   //  signal-aware
     }
     throw new Error('AbortError: cancelled')
   }
   ```

   `finalize`  main  `FileEntry` + `file_ref(sourceType='painting')`, file_ref / orphan-sweep 

4. ****(overviewRenderer-side consumers):`useJob(jobId)` / `useJobProgress(jobId)`**** enqueue / cancel, PaintingService  IPC  `painting.generation.${id}`  cache

##  vendor  job

dmxapi(openai-flat )/ ovms / silicon / aihubmix( async)/ openai (`submit()`  `imageUrls`  `taskId`)** `painting.generate` handler**  `taskId?`  `imageUrls?` ( execute ), job  vendor ,

## ( submit/poll)

|  | () |  Job  |
|---|---|---|
| **** | ,task id  |  `providerTaskId`,`recovery: 'retry'` ()—— **** |
|  |  | per-queue +  `globalMaxConcurrency` |
|  / backoff |  | ,`JOB_HANDLER_THREW` / `JOB_HANDLER_TIMEOUT`  |
|  | `paintingAbortControllerStore`( Map) | Job `cancelRequested` → `ctx.signal`,transport  `AbortSignal` |
|  /  |  cache |  `JobSnapshot` + `reportProgress` |

##  / 

- ****:`providerTaskId`  `poll` **** `await` (§2 CRITICAL)enqueue  idempotency key, vendor 
- **recovery **: vendor  `retry`();execute **** `ctx.metadata.providerTaskId` 
- ****:`while (!ctx.signal.aborted)` + `sleep(N, { signal })`, `while (true)` /  signal  `sleep`( N ms, §2 anti-pattern)
- ****: main  FileEntry + `file_ref`, file_ref / orphan-sweep

## 

:

- `paintingAbortControllerStore`( Job cancel)
- `painting.generation.${id}`  cache( `useJob` / `useJobProgress`)
- ( handler.execute)

## 

- ** transport  main** `src/renderer/aiCore/provider/custom/*`  transport (`src/main/aiCore` ,, transport )transport  main , JobHandler 
-  boundary  harness(`src/renderer/aiCore/provider/custom/__tests__/boundary/`) `PaintingGenerateJobHandler`  request/response 

## 

- [`../../../docs/references/job-and-scheduler/overview.md`](../../../docs/references/job-and-scheduler/overview.md) — DB Renderer 
- [`../../../docs/references/job-and-scheduler/handler-authoring.md`](../../../docs/references/job-and-scheduler/handler-authoring.md) — §2 remote-pollrecovery × catchUp handler 
- [`../../../docs/references/job-and-scheduler/concurrency-and-locks.md`](../../../docs/references/job-and-scheduler/concurrency-and-locks.md) — 
- [`../../../docs/references/ai/image-generation-parameters.md`](../../../docs/references/ai/image-generation-parameters.md) — (transport / )
