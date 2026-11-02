---
description: Local WebSocket client acceptance specification for remote protocol conformance, real Desktop execution, recovery, security, and weak-network budgets
sources:
  - src/main/features/apiGateway
  - src/main/ai/streamManager
  - tests/helpers/db
  - tests/helpers/http/server.ts
  - tests/__mocks__
  - vitest.config.ts
---

# Remote Agent Testing Specification

> ****  WebSocket client 
>  [API ](./remote-agent-access.md)
> [](./remote-agent-implementation.md)  [S01–S13 ](./remote-agent-sequences.md)
>  `server.test.ts`  listener/

 PR #20717 `remoteAccess`
`RemoteCommandService`  owner 

## Acceptance topology

 **Node WebSocket client** socket Mobile UI

```text
Local test client key cursor/command
    │ ws://127.0.0.1:<>/v1/remote/connect
    │  +  JSON-RPCloopback 
    ▼
 API Gateway → RemoteAccessService →  AiStreamManager
                          │                    │
                    journal / checkpoint    runtime
                          │                    │
                          └────  SQLite ───┘
```

Gateway  route
`127.0.0.1`  handler  WS server  Gateway 
 client  `ws`  packed remote-protocol
 Desktop  `requestRouter/agentCommands/agentProjection` 
 client  JSON/bytes typed API 

 provider/runtime  driver `AiStreamManager`
RemoteAccessService  driver  runtime
 wire
driver 

 client  Desktop  smoke
Agent fixture
 Desktop ** approve/debug/reset **

## Test layers and coverage claims

|  |  |  |
|---|---|---|
|  |  JSON/Unicode/packed artifact | schemareducer WS  |
|  WS  |  socket/Gateway/remote/stream owner/SQLite +  runtime |  Desktop  |
| / |  ServiceContainer Desktop worker/ |  durable admission  epoch  |
|  runtime smoke |  client +  runtime +  | runtime // driver  |
|  Mobile/Relay  | Expo/Metro  relay |  Node client  |

 profile  WS  blocked
 plaintext/auth bypass “ WS ” runtime 
skip  runtime 

## Proposed test files and client functions

```text
src/main/services/remoteAccess/__tests__/
├── support/
│   ├── remoteTestClient.ts        #  WSRPC
│   ├── remoteTestHarness.ts       #  DB/
│   ├── scriptedRuntime.ts         #  driver Remote mock
│   ├── clientStore.ts             #  projection/cursor/pending command
│   └── faultControl.ts            # /
├── protocol.integration.test.ts  # RPC//route/
├── execution.integration.test.ts # send/stream/approval/cancel  DB
├── recovery.integration.test.ts  # checkpoint/replay/response loss/client restart
├── lifecycle.integration.test.ts # container///backup pause
├── crash.integration.test.ts     # worker  DB 
└── flowControl.integration.test.ts # byte quota//
```

 support SDK
 `packages/remote-protocol/tests`fixtures 

```ts
interface RemoteTestClient {
  connect(url: string, identity: TestDeviceIdentity): Promise<void>
  hello(offer: ProtocolOffer): Promise<ProtocolSelection>
  authenticate(input: AuthenticateParams): Promise<void>
  request<M extends AgentMethod>(method: M, params: AgentParams<M>): Promise<AgentResult<M>>
  sendRawJson(value: unknown): Promise<void>
  sendPlaintextForTest(bytes: Uint8Array): Promise<void>
  nextNotification(method: string, deadlineMs: number): Promise<JsonRpcNotification>
  disconnect(mode: 'graceful' | 'abrupt'): Promise<void>
  dispose(): Promise<void>
}
```

`sendPlaintextForTest` **** malformed JSON
 plaintext  bytes 
`nextNotification` 
client  reconnect/ commandId

## Required scenario matrix

S T /

| ID |  |  |
|---|---|---|
| S01  | claim / |  key  pending claim key  Agent |
| S02  | / release Mobile/ Desktop  Mobile/ Desktop offer  |  `UPGRADE_REQUIRED` offer hello  capabilities/domain  |
| S03  | listener // checkpoint  activate |  |
| S03a checkpoint  | /// digest live baseline |  projection/cursor  prepare  |
| S03b  | / buffersnapshot  replay  execution |  chunksnapshot  terminal  |
| S04  |  send/emoji/ partreasoning// |  UTF-8 offsetstable IDsrevisions |
| S04a  |  | EOF  finalizing durable history  terminal completed |
| S04b  |  | durable history  ID  created  message/part  checkpoint |
| S05  | admission  RPC id  commandId/body | DB /get/retry  |
| S05a  |  ID  text/ NOT_FOUND |  body  `IDEMPOTENCY_CONFLICT`NOT_FOUND  ID |
| S06  |  ACK / |  cursor  cursor |
| S07  |  suffix epochcursor  HDesktop  |  checkpoint/reset session/protocolVersion  execution  epoch/ epoch Agent  |
| S07a  |  |  cursor/ACK cursor  checkpoint append upsert  |
| S08 client  |  client worker  store | projection/cursor “ cursor+”pending command  |
| S09  |  revision IDinput digest |  Agent  |
| S10  |  |  command  |
| S11  | token /refresh key  Agent  | grace  approved key  token key/ token  pending command |
| S12  |  ACKequal/behind/ahead/wrong-epoch ACK | equal behind/ahead/wrong epoch  reset |
| S13  | Desktop  | / epoch Go relay  |
| T01 RPC  | string/number/null id id JSON/envelope/method/params |  idnotification request-only notification  |
| T02 Batch |  activate entry/aggregate bytes |  batch /DB  |
| T03  |  provider token/API key deviceId/ command/pagecontent  session  | provider  Agent handle/ `NOT_FOUND` API  Agent  |
| T04  | / tool output revision  |  ContentRef/ revision  |
| T05  |  pin/ | / |
| T06  | listener /backup pause/drain |  socket/timer/observer/pin owner |
| T07 / | /receipt DB  |  authority |
| T08 / |  ID  ID  idle revision |  ID  session  generation  |
| T09  |  container ready  |  Gateway↔Remote  ready  conditional  |
| T10  | packed artifact  Node  Expo  | /Node-only API  runtime schema  advertise |
| T11  |  key |  paired-device/refresh  grantId/key  Agent  provider  grant  |
| T12  |  Agent |  HTTP  Agent  |

T12 [](../api-gateway/remote-agent-access.md#shared-infrastructure-for-configuration-transfer-and-agent-access)
 Agent-only 

## Released-version compatibility

 [API ](./remote-agent-access.md#protocol-version-compatibility) 
 v1v2  v2 
 release 
packed package/fixtures `protocolVersion: 1` 

 hello //
send→stream→reconnect→approve/cancel 
 checkpoint cursor pending command


## Crash and race protocol

 `throw`socket **** OS 
 SQLite 

|  | / |
|---|---|
| DB transaction commit  |  command/ ID  |
| commit activation  |  reservation intent authority |
| `activating` / |  interrupted |
| receipt settle  |  interrupted |
| listener // checkpoint  |  reset/ |
| activation pump  | / reset/close |
|  commit /ACK  | cursor  |

 composition/ driver  debug API
 sleep /
`Promise.all` 

** it**  worker
 Desktop DB  DB  `setupTestDatabase()`  migrations
 harness /
 DB  truncate/cleanup  harness

## Fault injection and weak-network measurements

[WebSocket](https://www.rfc-editor.org/rfc/rfc6455)  TCP 
/
// reducer fixtures 


 admission  socket client 
client  ACK 
“ ACK”“ socket ”

****

| Profile |  |
|---|---|
| local | / runtime  |
| slow |  150 ms  64 KiB/s 16 KiB/s |
| unstable | slow  seed  0–100 ms  64  3  |
| stalled |  ACK  socket / |

checkpoint/history  fake timers
 socketTTL/ clock +  sweep/ deadline 

/ WS framing  TCP/TLS event 
 H cancel /journal/pin 
 loopback chunk seed

 reset
 API /hello hello 
“”RSS 


 chunk  N  2N 4096/8192  chunk
 checkpoint/
 `B(2N) / B(N) ≤ 2.2` `part.completed` 
 fixture “ append”
 SLO 

## Assertion and isolation rules

1.  test  durable state `toHaveBeenCalled`
    snapshot//offset  reducer 
2.  wire traceclient projectionDesktop DB runtime 
   
3.  migrations  DB [Database Testing](../testing/database-testing.md)
    mock Drizzle `RemoteCommandService` mock 
    mock  ServiceContainer 
4.  connect/request/event/close  deadline ID
   “”
5. DB  client store harness  `test.concurrent`
   teardown /worker/server pin timer/
6.  CI  shell/file  private key
   token secret  synthetic  seed
7. 
    Expo 

## Running and release evidence

****

```sh
pnpm test:main src/main/services/remoteAccess/__tests__/protocol.integration.test.ts src/main/services/remoteAccess/__tests__/execution.integration.test.ts
pnpm test:main src/main/services/remoteAccess/__tests__/recovery.integration.test.ts src/main/services/remoteAccess/__tests__/crash.integration.test.ts
pnpm test:main src/main/services/remoteAccess/__tests__/lifecycle.integration.test.ts src/main/services/remoteAccess/__tests__/flowControl.integration.test.ts
```

 `pnpm test <path>` `pnpm lint`  testsdocs-only 
`pnpm docs:index` `pnpm docs:check`/packed consumer 
 README  CI `test:remote` 

commit SHA artifact/hashNode/OS/Mobile/Desktop releasecrypto/protocol/runtime
 limits IDseed//blocked/skipped/
trace Desktop smokeExpo/Relay  CI 

 advertised protocolVersion/runtime 
 profile  runtime  Expo packed-artifact/ blocked  skipped
Relay  S13  Go relay  direct 
