# /

> :2026-08-03()
> : `SuperAgentCtxTest`( 5000→100000`context_window`  16000)+ cherry-electron-dev ,(aihubmix::claude-sonnet-4-6 / gemini::gemini-2.5-flash)
> :feat/context-build-truncation  @ `7f0a0fbd34`( #1#5#6  main ,)
>  `tool-result-db-trim.md` ;

## (2026-08-03,)

|  |  |  |
|---|---|---|
| #1 tool_invoke schema 400 | ✅ (: `jsonSchema()`  provider-utils + `sanitizeSchema`  `additionalProperties:true`) | `2ec4f0c07f` / `@ai-sdk__anthropic.patch` |
| #2  read_file  | ✅ ( + ) | `81a7e1ee37` |
| #3 read  | ✅ (read_file / fs_read persist  text-field codec) | `793b77885f` |
| #4 in-loop  | ✅ (prepareStep ,) | `8bfe78af9a` |
| #5 AiTurnTrace  | ✅ (non-recording span  convert/sink;spanConvert ) | `479d4a370a` |
| #6 MCP  | ✅ ( warm  +  mcpMode  `'manual'`) | `9c349245e8` |
| #7 web () | ✅  P1-P3( codec;P4 truncatable ) | `f406425279` / `c10902e244` / `793b77885f` |

## #1 tool_invoke  inputExamples  schema  → Anthropic  defer  400

**:(main  bug, issue)**

- ****:tool defer (auto  >  10% ),meta ,Anthropic ( aihubmix)
  `tools.N.custom: Example at index 0 is invalid: False schema does not allow "cherry studio latest release". Each example must match the tool's input_schema.`
  ; MCP(defer ); Gemini ()defer (tool_search/tool_invoke )
- ****:`src/main/ai/tools/adapters/aiSdk/meta/toolInvoke.ts` 
  `inputExamples: [{ input: { name: 'web_search', params: { query: 'cherry studio latest release' } } }]`
   `params: z.record(z.string(), z.unknown()).optional()`  zod→JSON Schema ( schema  `false`),Anthropic API  schema  example
- ****:Anthropic  + auto ( 200k  ≈20k tokens  MCP ,;) MCP ," MCP  Claude "
- ****(): example  schema; `inputExamples`;anthropic provider  schema  examples `toolSearch.ts`/`toolInspect.ts`  examples 
- **✅ (`2ec4f0c07f`,)+ **: zod ——zod v4  `additionalProperties: {}` , `@ai-sdk/provider-utils`  `addAdditionalPropertiesToJsonSchema`  object ** `additionalProperties: false`**, `params` (example  400,):`toolInvoke.ts`  `jsonSchema()`(`asSchema`  schema ,),`params`  `additionalProperties: true`, zod `safeParse`;`inputExamples` ()`toolSearch`/`toolInspect` :examples ,
- **✅ (2026-08-03 ,`patches/@ai-sdk__anthropic.patch`)**: aihubmix  400:`@ai-sdk/anthropic`  `sanitizeSchema`( `@ai-sdk__anthropic.patch`  `sanitizeJsonSchema`  `prepareTools` , `input_schema` )**** object  `result.additionalProperties = false`, asSchema  `params: additionalProperties:true`  `false``asSchema` (provider-utils), provider  sanitizer ——**** clobber: `sanitizeSchema`  `result.additionalProperties = schema.additionalProperties === true ? true : false`( `true`,,) `aihubmix.anthropicTools.test.ts`  wire schema:`input_schema.properties.params.additionalProperties === true`  `false`—— `prepareTools`→`sanitizeJsonSchema` , Electron

## #2 durable ,read_file 

**:()**

- ****:16k (20  read_file), turn  durable , user  `compaction_summary`:
  1. served  file part → `collectFileAttachments`  → `hasFileAttachments=false` → **read_file **,( read_file);
  2. ,( LOG-0001  temperature, 119, 21.1)
- ****: `<persisted-output>` marker + fs_read ( +  allow-list ,);****
- ****: serve  fileAttachments(allow-list  served parts ,); read_file 
- ****:`PersistentChatContextProvider.resolveCompactedHistory`()× `buildAgentParams.collectFileAttachments`( request.messages )
- **✅ (`81a7e1ee37`)**:——`resolveCompactedHistory`  RAW  `fileAttachments` , `AiStreamRequest.fileAttachments`(main , IPC),`buildAgentParams` (read_file  + allow-list  served parts ); durable (`[Files attached in this conversation remain readable in full via the read_file tool: …]`,,),

## #3 read (v1 ,)

**:(,)**

- ****:
  -  1: marker  fs_read  3 ,fs_read (`{kind,text,...}`,truncatable:false +  string/mcp-content ) persist  → 95KB  ~66KB  fs_read ;
  -  2:20  read_file  169KB  `message.data`
- ****:v1  string  MCP ;read (fs_read/read_file)**,DB **
- ****: `shape:'json'`(+); read  persist ——persist  in-flight (fs_read  in-flight )
- **✅ (`793b77885f`, #7 codec P2/P3)**:read_file  `makeTextFieldCodec({textKey:'text'})`(persist —— toModelOutput  text,in-flight  json,),169KB  `text`  blob;fs_read  in-flight `truncatable:false`()+  codec  persist lane——( cap == persist , `>`),, contentHash  echo blob(:echo  cat -n , blob)

## #4 in-loop ( accepted cost,)

**:-()**

- ****:16k 20  read_file , 9-11k tokens,: 44k→50k→60k→66k  20  446k input tokens($0.83,prompt cache  cacheRead 252k)
- ****: memoize (),`inLoopCompaction.ts`  "no memoization in v1"
- **✅ (`8bfe78af9a`)**:prepareStep  `{consumedCount, compactedPrefix}`, `[...compactedPrefix, ...messages.slice(consumedCount)]`——(** LLM **),(, durable ) O()  O(),44k→66k 

## #5 turn  ToolLoopTerminalError  AiTurnTrace 

**:(main ,)**

- ****:`WARN [AiTurnTrace] Failed to persist root span ai.turn TypeError: Cannot read properties of undefined (reading '0') at AiStreamManager.onExecutionError` ——  trace  trace
- ****:`AiStreamManager.onExecutionError` → AiTurnTrace 
- **✅ (`479d4a370a`)+ **:""—— **developer mode  TracerProvider**,`startSpan`  NonRecordingSpan( `startTime`),end  `convertSpanToSpanEntity` → `span.startTime[0]`  TypeError** turn , outcome **, WARN :`AiTurnTrace` end  `startTime`  span  no-op ( convert  sink);`spanConvert.ts`  startTime ( endTime ) provider :`handle.end()`  throwsink 

## #6 mcpToolIds (,)

**:**

- ****:`resolveTools`  `request.mcpToolIds`  **undefined**  `resolveAssistantMcpToolIds(assistantId)`; composer , DB  MCP : renderer , renderer 
- ****: composer MCP ;,
- **✅ (`9c349245e8`)+ **:""——** IPC schema  `mcpToolIds` **,composer  MCP  `mcpServerIds`, `resolveAssistantMcpToolIds` :① `McpCatalogService.listTools` cache-only—— `[]` ( 5 ), vs ;②  mcpMode (main `'manual'`/`'disabled'`shared DEFAULT `'auto'`renderer `'disabled'`): `await warmToolsCache(server.id)`(); shared `DEFAULT_MCP_MODE = 'manual'` resolveAssistantMcpTools 

---

### : bug 

-  `ToolLoopTerminalError`(20 ) —— ,
- gemma  —— 
- ;#2 ""

---

## : ×  × (AI_SDK_DEVTOOLS=1)

> :16k (aihubmix::claude-sonnet-4-6, gemini-2.5-flash),4 (/C919 /SQLite /)+ 4 ;devtools  24  `.devtools/generations.json`

###  1:web /(,)

`web_search`/`web_fetch`  `truncatable: false`(,citation )——****: prompt  + `message.data` ,() `chat.web_search.compression`(method/cutoff_limit, none), context-build  citable  persist , citation  marker 

> ✅ 2026-08-03 :#7 codec P1-P3 ,web_search/web_fetch/kb_search +(citation , skeleton ), cutoff()

###  2:durable ,prompt -68%,

 4 ,durable  turn ( 2,391 ;: error ,)devtools  prompt  28KB  9KB(-68%); 8 ,****( in-loop ,durable  write-once-serve-many)

###  3: 4/4 ()

-  R1( 40 ):,"" ✅
-  R2(C919):( web_fetch)," 5555km " ✅
-  R3/R4(SQLite 3.51.0 / 2025-11-04 8848.86 ): ✅
- : digest(✅ Completed / ❌ Failed/Incomplete / Context to Preserve),"" read_file  2000 (#2  LOG-0001 )——****, QA ,

###  4: ≈99.9%()

 9  Anthropic usage: `noCache`  **1-3 tokens**,`cacheRead` 3,087→4,604 ,`cacheWrite` —— +  web ,provider Gemini  60-80%

### 

- **#1 **: MCP( #6 ),16k  auto  → defer  → aihubmix(Anthropic API) 6  400,; MCP 
- anthropic  gemini /(gemini free tier 5 req/day)

---

## #7 web_fetch/web_search ——

**:( 1;web_fetch )**

### 

1. **In-flight **: `[{id:'<prefix>-<n>', title, url, content}]` JSON (`webLookup.ts` `mapResponse`),"" `[cite:id]` json  stringify  head/tail——cite id  content ,()()
2. ** citation **:`src/renderer/utils/message/citations.ts`  citation registry ** message.data  parts **("no persisted reference metadata"),///

### ()

-  turn(durable  keep ,in-loop  turn)——** fetch **`web_fetch`  readable content ( 50-200k chars),;search(max_results=5×snippet) 3-6k chars
- ,
-  `chat.web_search.compression`(`postProcessing.ts`,cutoff/rag) none

### 

1. **web_fetch:,** URL  **input** (result ), content ;,head/tail + marker + fs_read  filesystem read ;in-flight  flag ;persist  `shape:'json'`(#3) citation-aware ( `{id,url,title}` )
2. **web_search: flag** 100k (no-op),** cutoff **( content id/url/title), truncatable
3. **:** flag  citable —— result  content truncator `perTool`  per-tool  reducer, web_search/web_fetch/kb_search +

****:① web_fetch  flag(,)→ ② search  cutoff  → ③ `shape:'json'` + citation-aware ( #3 )→ ④ per-tool reducer

** sanity check**:200k  search  ~100+ ();fetch  50k+——

**✅ ( codec ," flag")**:web_fetch  codec(P1,`f406425279`);web_search/kb_search  codec(P3,`793b77885f`, no-op); cutoff  schema  `'none'→'cutoff'`( classification ,,)citation  P2  skeleton  +  skeleton 

---

## #7 :——/(Tool Output Codec)

> :****(extractText → head/tail),****——(id/url/title)+ ,; `truncatable` "" = ****

### :(codec)

```ts
// ToolEntry  truncatable ( schema ,)
interface ToolOutputCodec<TOutput> {
  /** :(/,)+ () */
  deflate(output: TOutput): { skeleton: unknown; blobs: Array<{ key: string; text: string }> } | null
  /** : +  → ( / ai.tool.get_result ) */
  inflate(skeleton: unknown, blobs: Record<string, string>): TOutput
}
//  codec =  'opaque'(/ MCP  head/tail);
// 'exempt' ( fs_read  in-flight )
```

 codec:
- **web_search / web_fetch / kb_search**:`entities` —— = `[{id,url,title}]`,blobs =  `content` content  head/tail + marker,** prompt  DB **
- **fs_read / read_file(#3 )**:`json-text-field` —— = `{kind,startLine,...}`,blob = `text` fs_read  in-flight (), **persist **; blob  contentHash  entry,

### ( lane )

```
trimToolOutput(toolName, output, budget)          // , registry codec
  ├─ in-flight(truncator): per-entity marker →  prompt
  └─ persist(trimToolOutputs): blob 
       $persistedToolOutput: {
         shape: 'text' | 'mcp-content' | 'entities' | 'json-text-field',
         skeleton,                       //  → citation registry 
         blobRefs: [{ key, fileEntryId, vfsFilename, head, tail, totalChars, totalLines }]
       }
```

 blobRef  `tool_output` file ref( ref );fs_read  per-request allow-list  blobRefs ;`ai.tool.get_result` /  `inflate`

### ()

1. ****——prompt  id/url/title(),DB  citation registry ;
2. ****—— codec ,in-flight  persist ( `extractPersistableText`/truncator `extractText` );
3. ****——marker/,, ≈100% ();
4. ****—— blob  marker + fs_read  + UI ;
5. ****——codec (, per-part try/catch)

### 

|  |  |  |  |
|---|---|---|---|
| P1 | codec  + web_fetch entities codec( in-flight) | #7  | ✅ `f406425279` |
| P2 |  blob  + skeleton  + inflate / | #7 persist citation  | ✅ `c10902e244`( topics GET  bug) |
| P3 | web_search/kb_search codec +  cutoff ;fs_read/read_file  codec | #3  | ✅ `793b77885f` |
| P4 |  `truncatable`( codec/exempt ),truncator  `extractText`  `extractPersistableText`  codec |  | ⬜ ( truncatable  in-flight :codec  flag ,in-flight preservepersist  codec) |

****: `deflate/assemble`(in-flight )+  `spliceTextAtKey`/`inflateEntities`(persist /, blob key  JSON-pointer-lite , codec ) `deflate/inflate` ; shape  `'entities'` (`json-text-field`  blob  entities ,`key: '/text'`);fs_read  blob  cat -n **** blob  contentHash("", echo blob) lane :persist  entities  in-flight truncator  `JSON.stringify` 

****:`src/main/ai/tools/adapters/aiSdk/types.ts`(ToolEntry )`packages/aiCore/src/core/context/truncator.ts`( codec)`src/shared/ai/transport/persistedToolOutput.ts`(,)`src/main/ai/streamManager/persistence/trimToolOutputs.ts` + `src/main/ai/messages/persistedOutputRendering.ts`()`src/main/ai/tools/webLookup.ts` / `FsReadTool.ts`(codec )`src/renderer/utils/message/citations.ts`(skeleton ,)
