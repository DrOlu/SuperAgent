---
description: Proposed remote-protocol files and Desktop function contracts for RPC dispatch, atomic admission, journals, checkpoints, and lifecycle ownership
sources:
  - src/main/features/apiGateway
  - src/main/ai/streamManager
  - src/main/ai/agentSession/AgentSessionRuntimeService.ts
  - src/main/data/services
  - src/main/data/db/schemas
---

# Remote Protocol and Desktop Implementation Design

> **Desktop LAN  Mobile** 
> imports  DTO [API ](./remote-agent-access.md) 
> [](../api-gateway/remote-agent-access.md)  [](./remote-agent-sequences.md)
>  `src/main/services/remoteAccess/README.md`
>  README 

 WebSocket client 
[](./remote-agent-testing.md)

 PR #20717 `remoteAccess`
`RemoteCommandService`  owner 

## Design boundaries

[](../api-gateway/remote-agent-access.md#shared-infrastructure-for-configuration-transfer-and-agent-access)
provider/model  Agent RPC 
 provider/model  owner
 Agent  journal/checkpoint/ Agent 
 HTTP 

 Desktop 

- `remote-protocol` 
- Gateway  HTTP/WS `RemoteAccessService` 
- `AiStreamManager`  runtime/approval 
-  SQLite 

 `StreamListener`  `addListener()` buffer
 `observeTopic()``getTopicSnapshot()`  `commitAgentMessage` 
//
 owner  session  snapshot 
 `dispatch()` /steer  v1  idle-only send remoteAccess



[](../architecture/naming-conventions.md) [Main ](../architecture/main-process.md)

## Package files and exports

```text
packages/remote-protocol/
├── package.json                  #  .  ./agent JS fixtures
├── README.md                     # 
├── src/
│   ├── index.ts                  # common  re-export
│   ├── agent.ts                  # ./agent  re-export
│   ├── jsonRpc.ts                #  envelope schema id  null
│   ├── connection.ts             # helloauthpairing  schema 
│   ├── errors.ts                 # RemoteFailure 
│   ├── negotiation.ts            # 
│   ├── encoding.ts               #  JCS  UTF-8 
│   └── agent/
│       ├── resources.ts          # sessionexecutionmessagepartinteraction
│       ├── methods.ts            # //error details  schema map
│       ├── events.ts             # cursorprojection schema
│       ├── checkpoints.ts        # checkpoint DTO
│       ├── reducer.ts            # 
│       └── commands.ts           # mutation receipt
├── fixtures/                     # JSON 
└── tests/                        # /
```

`src/agent.ts`  package subpath  `agent/index.ts`  barrel
`package.json.exports`  root→agent 
`agent/*`  common  root barrel root  Agent 

Schema  TS  Zod 
 Node/Expo packed-artifact `agentMethods`  API 
`{ params, result, errors }` Desktop  handler 

### Common functions

```ts
type ProtocolSupport = { protocolVersions: readonly number[] }
type ProtocolOffer = { protocolVersions: readonly number[] }
type ProtocolSelection = { protocolVersion: number }

function negotiateProtocol(
  local: ProtocolSupport,
  remote: ProtocolOffer
): NegotiationResult

type NegotiationResult =
  | { ok: true; selection: ProtocolSelection }
  | { ok: false; error: RemoteFailure }

function connectionMethods<A>(authorizationSchema: RuntimeSchema<A>): ConnectionMethodSchemas<A>
function pairingMethods<A>(authorizationSchema: RuntimeSchema<A>): PairingMethodSchemas<A>
```

`RuntimeSchema<T>`  schema  schema 
`ProtocolSupport/ProtocolOffer`  `[1]` schema
`negotiateProtocol` 
`UPGRADE_REQUIRED`  `supportedProtocolVersions` wire/domain  capabilities
 offer 
 Mobile/Desktop release  v1 

/schema/reducer/ v1
 fixtures
 1
 [](./remote-agent-access.md#protocol-version-compatibility)

JSON-RPC  `jsonRpc.ts`  RPC engine
[JSON-RPC ](https://www.jsonrpc.org/specification)  envelope/batch/notification 
[json-rpc-2.0](https://github.com/shogowada/json-rpc-2.0) 


### Agent functions

```ts
type AgentMutation =
  | 'agent.sessions.create'
  | 'agent.messages.send'
  | 'agent.executions.cancel'
  | 'agent.interactions.respond'

type IntegrityPrimitives = {
  sha256(bytes: Uint8Array): string
}

function encodeAgentCommand<M extends AgentMutation>(
  method: M,
  params: AgentParams<M>
): Uint8Array

function encodeAgentCheckpointPage(page: AgentCheckpointPage): Uint8Array

function applyAgentEvents(
  projection: Readonly<AgentProjection>,
  batch: AgentEventBatch,
  materializedContent: MaterializedContent,
  integrity: IntegrityPrimitives
): ApplyAgentEventsResult

function installAgentCheckpoint(
  descriptor: AgentCheckpointDescriptor,
  pages: readonly AgentCheckpointPage[],
  materializedContent: MaterializedContent,
  integrity: IntegrityPrimitives
): InstallAgentCheckpointResult
```

`AgentMutation``AgentEventBatch`checkpoint  schema  `/agent` 
`IntegrityPrimitives`  common  root **** SHA-256
 Node crypto
 API “ crypto” wire 

|  | / |  |
|---|---|---|
| `encodeAgentCommand` |  named paramsJCS  `{ method, paramsWithoutCommandId }` |  Unicode  |
| `encodeAgentCheckpointPage` |  body `pageDigest` |  item  |
| `applyAgentEvents` |  →  projection/cursor `gap/epoch/revision/content` |  |
| `installAgentCheckpoint` |  live baseline →  projection/cursor |  |

`MaterializedContent`  `contentId + revision`  bytes /
 bytes fetch
 MobileDesktop  fixtures 
 hash/decoder 

 part ID  UTF-8 offset token  JSON diff
`part.completed`  finalizing 
 durable `history.committed`  overlay
message/part 
 cursor/ACK cursor
 checkpoint upsert 
 [v1 ](./remote-agent-access.md#v1-livehistory-boundary) 
 checkpoint  SDK

## Desktop file organization

```text
src/main/features/apiGateway/
├── ApiGatewayService.ts          # listener  LAN serving 
├── server.ts                     #  listener  WS upgrade /
├── app.ts                        # remote route  provider-key guard
└── routes/remoteAgent.ts          # /v1/remote/connect 

src/main/services/remoteAccess/
├── index.ts                      #  service 
├── README.md                     # 
├── RemoteAccessService.ts        #  lifecycle 
├── connection.ts                 # generation
├── secureChannel.ts              #  Desktop 
├── identity.ts                   # 
├── rpc.ts                        # JSON-RPC 
├── connectionHandlers.ts         # hello / authenticate / refresh / ping
├── pairing.ts                    # invitation/claim/ key 
├── authorization.ts              # /
├── agentHandlers.ts              #  method→handler 
├── agentQueries.ts               #  DTO 
├── agentCommands.ts              # durable command 
├── RemoteAgentListener.ts        #  StreamListener
├── agentProjection.ts            #  chunks// → Agent wire event/DTO
├── agentJournal.ts               # session/protocolVersion epoch seq
├── agentSubscriptions.ts         # prepare/activate/ack/close 
├── agentCheckpoints.ts           #  pinlease
├── agentContent.ts               # revision-pinned 
└── __tests__/                    #  helper 
```

 journal  `RemoteAccessService` 
/ manual singleton
method  Service/ lifecycle 

### Gateway and lifecycle contracts

```ts
interface RemoteAccessService {
  acceptConnection(peer: RemoteSocket): Disposable
  createInvitation(input: LocalInvitationInput): Promise<LocalInvitation>
  decidePairing(claimId: string, decision: LocalPairingDecision): Promise<void>
  revokeAgentAccess(deviceId: string, expectedGrantId: string): Promise<void>
  pause(): Disposable
  drain(opts: { timeoutMs: number }): Promise<{ stragglerIds: string[] }>
}

type RemoteSocket = {
  send(record: Uint8Array): Promise<void>
  close(code: number): void
  onRecord: Event<Uint8Array>
  onClosed: Event<void>
}
```

 Desktop Gateway /
`acceptConnection`  ready backup pause  Node Gateway
 Elysia  WS upgrade  `ws`  upgrade 
listener 

Gateway  route  bootstrap
`application.get('RemoteAccessService')`  ready/active 
 RemoteAccessService  conditional  `getOptional()` 
Gateway  RemoteAccessService 
 `@DependsOn('ApiGatewayService')` Remote 
BeforeReady  Db/Preference/Cache  `@DependsOn`

Remote  `onInit`  Gateway Agent ingress sweep
`registerDisposable/registerInterval` `onActivate` `onDeactivate`
 channelcheckpointobserver  key material`pause/drain`
/ AgentLifecycleService 
 socket  Agent `application.get()` loggerService
 `application.getPath()`  helper 

`createInvitation/decidePairing/revokeAgentAccess`  UI  IpcApi handler
JSON-RPC method map paired-device  owner  DataApi

### Per-connection dispatch

```ts
function createConnection(peer: RemoteSocket, deps: ConnectionDependencies): RemoteConnection
function receiveRecord(connection: RemoteConnection, record: Uint8Array): Promise<void>
function dispatchRpcRecord(connection: RemoteConnection, plaintext: Uint8Array): Promise<void>
function closeConnection(connection: RemoteConnection, reason: CloseReason): void

type RpcCallContext = {
  connection: RemoteConnection
  afterReply(commit: () => void, abort: () => void): void
}

type AgentHandlers = {
  [M in AgentMethod]: (ctx: RpcCallContext, params: AgentParams<M>) => Promise<AgentResult<M>>
}
```

RPC /Agent handlersclock
handler  `satisfies AgentHandlers` schema 
 `protocol.ts`  async handler  SQLite 

`receiveRecord` / →  → UTF-8/JSON  →
 envelope  → / → method schema →  →  → handler →
result schema → / →  writer 
 stack provider 

 `secured/negotiated/authenticated/expired/closed`  generation
RPC pending 
`RemoteSocket.send()`  writer 
 buffered bytes 

Batch  bounded admission/preflight
 request-only  notification 
bootstrap  batch  hello/auth 
 request  `id: null`  id  notification

`afterReply`  adapter  batch  writer 
 commit  activation abort
 bulk pages 

### Authorization and pairing

```ts
function authenticateConnection(conn: RemoteConnection, input: AuthenticateParams): Promise<AuthContext>
function refreshConnection(conn: RemoteConnection): Promise<RefreshResult>
function authorizeSession(auth: AuthContext, sessionId: string, tx?: DbOrTx): AuthorizedSession
function authorizeCommand(auth: AuthContext, stored: StoredCommand, tx?: DbOrTx): void
function claimPairing(peer: ProvenPeer, input: PairingClaimParams): Promise<PairingClaimResult>
```

`AuthContext`  device/key/grantId params 
access token  enabled 
`authorizeSession`  view/send/approve  allowlist
 session  Desktop  Agent  lifecycle/runtime 
content/interaction/message  session ID 
`authorizeCommand`  device+grantId“”

 `ApiGatewayPairedDeviceService`  public key 
`agentRemoteAccess: { grantId, status: 'enabled' | 'revoked' }`/ scope/
capabilities/revision  provider token  Agent 
 grantId enabled  key
claim  invitation/device key  claimant

 `revokeAgentAccess`  deviceId+expectedGrantId 
 paired-device 
 provider  owner 
 token pending command  grantId /

## Execution-owner contracts

/ `remote/`  Agent runtime

|  |  |  |
|---|---|---|
| `ai/streamManager/AiStreamManager.ts` |  listener observe/snapshot topic  | remote adapter |
| `ai/streamManager/api/commitSessionCommand.ts` |  activation  | manager  |
| `ai/streamManager/context/agentSubmission.ts` |  reserve  idle-only  | commitSessionCommand dispatch |
| `ai/agentSession/AgentSessionRuntimeService.ts` | activation/recovery/approval  | stream owner |
| `ai/streamManager/persistence/*` |  durable history revision terminal success |  |

 main  main/renderer 
`src/shared/ai/transport` `remote-protocol`  wire DTO  remoteAccess

### Reuse existing stream observation

`RemoteAgentListener`  `StreamListener` RemoteAccessService 
session/protocolVersion journal  listener

|  /  | Remote adapter  |  |
|---|---|---|
| `addListener(topicId, listener)` |  buffer replay  `onChunk` |  stream buffer boolean  |
| `StreamListener.onChunk` |  message/part/execution  |  `UIMessageChunk`  |
| `onDone/onPaused/onError`terminal phases |  |  durable terminalEOF  |
| `observeTopic` + `getTopicSnapshot` |  execution  | observer  diff  |
| runtime  `onSessionInteractionsChanged` |  |  chunk |
| `removeListener` / observer `dispose` |  |  journal  |

 snapshot/replay 
 capture baseline/change  owner revision

1. ****  chunks
   snapshot  replay 
2. **** buffer  owner /
    journal owner
    buffer 
3. ****  active stream  `addListener` 
    topic/runtime  chunk listener 
    execution  buffer 
4. **** runtime session / owner
    chunk/terminal  owner

remote adapter Checkpoint C  C 
 remote journal 
 snapshot  buffer 

wire epoch/seq  remote journal /
 reset Agent message/part/execution
 owner  checkpoint 
 migration 

### Transactional command admission

```ts
interface AiStreamManager {
  commitSessionCommand<T>(
    sessionId: string,
    commit: (tx: DbOrTx, session: SessionCommandAccess) => T
  ): Promise<T>
}

interface SessionCommandAccess {
  reserveSend(input: { text: string; expectedIdleRevision: string }): Admission<RunReservation>
  reserveCancel(input: { expectedExecutionId: string }): Admission<CancelReservation>
  reserveDecision(input: InteractionDecisionPreconditions): Admission<DecisionReservation>
}

type Admission<T> = { ok: true; reservation: T } | { ok: false; failure: SessionCommandFailure }
```

 `withDispatchLock()` 
`commitAgentMessage` 
owner  topic  terminal persistence 
`withWriteTx`  `commit`callback ** async/Promise** thenable
`SessionCommandAccess`  callback 
 reserve  idle 

callback  →  command /identity  →  →
 reserve →  accepted  rejected reserve  session/execution/message
 durable intent  tx rejected receipt 
 owner  activation
 handler /

 UIschedulerdelivery  remote  `hasLiveStream()`
**** expected execution/revision/digest 
 remote  approval pending 
 `dispatch/abortAndDrain`

owner  activation  `reserved → activating → applied` runtime 
 `activating` reserved intent activating 

 intent  remote receipt  opaque reservation ID owner 
remote AI  wire receipt

## Command and data functions

```ts
async function sendMessage(ctx: RpcCallContext, input: AgentParams<'agent.messages.send'>) {
  const identity = encodeAgentCommand('agent.messages.send', input)
  return application.get('AiStreamManager').commitSessionCommand(input.sessionId, (tx, session) => {
    const auth = requireCurrentAuth(ctx.connection)
    const resource = authorizeSession(auth, input.sessionId, tx)
    const key = { deviceId: auth.deviceId, grantId: auth.grantId, commandId: input.commandId }
    const existing = remoteCommandService.findMatching(tx, key, identity)
    if (existing) return toCommandReceipt(existing)
    const admission = session.reserveSend(input)
    return toCommandReceipt(remoteCommandService.recordAdmissionTx(tx, key, identity, resource, toStoredAdmission(admission)))
  })
}
```

 store  adapter  DTO `data/` 
`SessionCommandAccess`remote handler `identity` 
params /RPC id 

|  |  |
|---|---|
| `data/services/RemoteCommandService.ts` | `get(key, tx?)``findMatching(tx, key, identity)``recordAdmissionTx(...)``settleTx(tx, key, expectedStatus, outcome)``compactTerminalTx(...)` |
| `data/db/schemas/remoteCommand.ts` | PK  device+grantId+commandidentitymethodresourcereservationtombstone  |
| `data/services/ApiGatewayPairedDeviceService.ts` |  `get`  `get(deviceId, tx?)` `enableAgentAccessTx(tx, deviceId, provenKey)``revokeAgentAccessTx(tx, deviceId, expectedGrantId)` RemoteGrantService |
| `data/db/schemas/apiGatewayPairedDevice.ts` |  public key  `agentRemoteAccess`grantIdenabled/revoked remoteGrant  token/ |
|  session/message/interaction  owner | `reserve…Tx`activation intent/part  history revision |

`settleTx`  callback `sessions.create`
 session dedupecancel/respond
 send  command  reserve
 mutation  handler  command bus

`agentQueries.ts`  `listAgents/listWorkspaces/listSessions/getSession/listMessages/
listParts/listInteractions/getInteraction/getCommand``agentContent.ts`  `readContent`
 token  device+grantIdsession/query/filter/history revision 
live  checkpoint/journal pin durable  owner
 opaque content ID base64 

 schema  migration
 Agent /
 authority dedupe 

## Journal, checkpoint and subscription functions

```ts
function appendEvents(stream: AgentJournal, events: readonly PendingAgentEvent[]): void
function prepareSubscription(conn: RemoteConnection, input: SubscribeParams): Promise<SubscribeResult>
function readCheckpoint(conn: RemoteConnection, input: CheckpointReadParams): CheckpointPageResult
function prepareActivation(conn: RemoteConnection, input: ActivateParams): PreparedActivation
function acknowledge(conn: RemoteConnection, input: AckParams): AckResult
function closeSubscription(conn: RemoteConnection, subscriptionId: string): void

type PreparedActivation = {
  result: ActivateResult
  commit(): void
  abort(): void
}
```

`PendingAgentEvent`  remote  seq/revision 
kind/payload  AiStreamManager 

`agentJournal.ts`  `(sessionId, protocolVersion)`  epoch projection seq 
`agentSubscriptions.ts`  phaseprepared cursorlastSentlastAck
lease `agentCheckpoints.ts`  pages/content pins
 registry  service  epoch

|  |  |
|---|---|
| `appendEvents` |  append flush  revision/seq |
| `prepareSubscription` |  stream flush  H  C  checkpoint  C  |
| `readCheckpoint` | //lease pageIndex/body/digest lease checkpoint  |
| `prepareActivation` |  prepared cursor  reservation commit/abort |
| activation `commit` | // active  pump  reset/close |
| `acknowledge` |  session/epoch`lastAck ≤ cursor ≤ lastSent` replay  |
| `closeSubscription` |  pin/credit/queue ID  |

 prepared→activating  activate 
commit / reset/close 
batch  `ctx.afterReply`  commit 

`RemoteAgentListener`  stream callbacks`agentProjection.ts`  chunks
 owner  DTO `projectChunk`
`projectInitialState``toSessionSummary` epoch 
 approve-only  →
`history.committed` → execution terminalEOF  finalizing

prepare **** journal 
 projection journal  listener 
 checkpoint/ projection  pin  Agent 
 reset  epoch seq

 sweep  invitation/token/prepare lease/journal  preparation lease
 checkpoint pins journal  pump
 resetACK
ACK  event credit 

## Replacement map and implementation slices

| / |  |
|---|---|
| `protocol.ts` |  schemasDesktop  handler policy |
| `requestRouter.ts` | `rpc.ts` + `connectionHandlers.ts` + `agentHandlers.ts` |
| `server.ts`  listener | Gateway  listener upgrade `connection.ts` |
| `RemoteAgentSubscription.ts`  snapshot | journal + subscriptions + checkpoints session/protocolVersion epoch |
| `messageProjection.ts` | `agentProjection.ts`  |
| `messageDetails.ts` / `artifactAccess.ts` | `agentQueries.ts` / `agentContent.ts`  opaque revision-pinned reads |
| provider token  Agent  |  key proof +  Agent  token  |



|  |  |  |
|---|---|---|
| 1.  | common  Agent schemasreducerfixturespacked artifact | Unicode/JCS// checkpoint |
| 2.  |  listener/observe  IDprojection/journal | S03/S04// |
| 3. durable command | owner reserve/activatepaired-device /receipt/intents  | S05/S07/S09/S10 ID / |
| 4.  | checkpointprepare/activate/ack sweep | S06/S08/S12 cursor  ACK  |
| 5.  |  profile Gateway routepairing/authRPC adapter | S01/S02/S11 token batch  |

 main wrapper
 `setupTestDatabase()`/ mock Drizzle  fixtures 
offset reducer WebSocket/RPC 
 loopback harness Expo 
