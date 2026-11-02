---
description: Target remote Agent sequence diagrams, connection states, module ownership, and failure-recovery acceptance scenarios
sources:
  - src/main/features/apiGateway
  - src/main/ai/streamManager
  - src/main/ai/agentSession/AgentSessionRuntimeService.ts
  - src/main/data/services
---

# Remote Agent Sequences and Modules

> **** 
>  [API ](./remote-agent-access.md) 
>  [](../api-gateway/remote-agent-access.md#implementation-order-and-acceptance)

 [](./remote-agent-implementation.md)

[](../api-gateway/remote-agent-access.md#shared-infrastructure-for-configuration-transfer-and-agent-access)
 Agent S01  Agent
 Agent 

WebSocketJSON-RPC
JSON-RPC `id` 
`commandId` `epoch + seq` 
 `sessions.*``messages.*``subscriptions.*`  `agent.*` 
 Agent/session/workspace 
`grantId`  ID ID 

 PR #20717 `remoteAccess`
`RemoteCommandService`  owner 

## Module map

```mermaid
flowchart TB
    subgraph Mobile
        UI[ UI]
        M1[M1  RPC]
        M2[M2 ]
        M3[(M3 )]
        UI --> M2
        M2 --> M1
        M2 --> M3
    end
    P[P <br/>Schema /  /  reducer]
    M1 -.  .-> P
    M2 -.  .-> P
    subgraph Desktop
        D1[D1 Gateway  RPC ]
        D2[D2 ]
        D3[D3 ]
        D4[D4 Agent ]
        D5[(D5 )]
        D1 --> D2
        D1 --> D3
        D1 --> D4
        D1 --> D5
        D4 --> D5
        D4 -->|| D3
    end
    M1 <-->| JSON-RPC| D1
    D1 -.  .-> P
    D3 -.  .-> P
```

|  |  |  |
|---|---|---|
| **P ** | JSON-RPC Agent DTO reducer |  `packages/remote-protocol` `/agent` socket |
| **M1  RPC** |  | Mobile  `src/backend/services/remoteAccess` JSON-RPC  |
| **M2 ** | ACK |  Mobile  `src/shared/contracts`  |
| **M3 ** |  desktop/device/grantId/protocolVersion/session  | Mobile `src/backend/data`  |
| **D1 Gateway  RPC ** |  |  `src/main/features/apiGateway` `src/main/services/remoteAccess` |
| **D2 ** | Agent / |  paired-device provider  Agent  |
| **D3 ** | /protocolVersion  epoch |  `RemoteAgentSubscription.ts` / Agent |
| **D4 Agent ** |  stream listener// |  `AiStreamManager`Agent lifecycle/runtime remoteAccess |
| **D5 ** | /tombstone |  `RemoteCommandService` |
| **R Relay** |  Desktop |  Go relay Agent  Agent |

 D1→D4  remote adapterD4  D3 
D3  D4  StreamListeneraddListener observeTopic  runtime D4  D3P 

## Connection states

```mermaid
stateDiagram-v2
    [*] --> Offline
    Offline --> Connecting: 
    Connecting --> Securing: WS 
    Securing --> Negotiating: 
    Negotiating --> Pairing: 
    Pairing --> Authenticating: 
    Negotiating --> Authenticating: 
    Authenticating --> Connected: 
    Connected --> Recovering: 
    Recovering --> Ready: 
    Ready --> Recovering:  resetRequired
    Ready --> Authenticating: 
    Connected --> Backoff: 
    Recovering --> Backoff: 
    Ready --> Backoff: 
    Connecting --> Backoff: 
    Backoff --> Connecting: 
    Negotiating --> Blocked: 
    Authenticating --> Blocked: 
    Securing --> Blocked: 
    Pairing --> Blocked: 
    Blocked --> Connecting: 
    Ready --> Offline: 
    Backoff --> Offline: 
```

 Backoff
“Connected”Ready  UI 
 wire 
M1  generation
 activate  subscribe 
highWatermarkReady  Desktop 
 UI  RPC 

## Scenario index

|  |  |  |
|---|---|---|
| [S01 ](#s01-first-pairing) | M1D1D2 |  |
| [S02 ](#s02-version-negotiation) | M1PD1 |  |
| [S03 ](#s03-checkpoint-and-activation) | M2M3D3D4 |  |
| [S04 ](#s04-send-and-stream) | M2M3D1D3D4D5 |  |
| [S05 ](#s05-lost-command-receipt) | M2M3D4D5 |  commandId  |
| [S06 ](#s06-reconnect-and-replay) | M1M2M3D3 |  |
| [S07  Desktop ](#s07-reset-and-desktop-restart) | M2D3D4D5 |  Agent |
| [S08 Mobile ](#s08-mobile-crash) | M2M3D3 |  |
| [S09 ](#s09-approval-race) | M2D2D4D5 | / |
| [S10 ](#s10-cancellation-race) | D1D4D5 |  E1  E2 |
| [S11 ](#s11-expiry-and-revocation) | M1D1D2D3 |  |
| [S12  ACK](#s12-backpressure) | M2M3D3 |  Agent ACK  |
| [S13 Relay ](#s13-relay-interruption) | M1RD1D3 |  epoch  |

## S01 First pairing

```mermaid
sequenceDiagram
    participant U as 
    participant M as M1 
    participant G as D1 RPC 
    participant A as D2 
    U->>A:  Agent 
    A-->>M: QR pin
    M->>G: WS + 
    G-->>M: 
    M->>G: connection.hello
    G-->>M: 
    M->>G: pairing.claim
    G->>A:  Agent 
    A-->>M: claimId D1
    A-->>U:  Agent
    alt 
        U->>A:  Agent
        A->>A:  paired-device  enabled  grantId
        M->>G: pairing.get(claimId)
        G->>A: 
        G-->>M: approvedauthorization
        M->>G: connection.authenticate
        G->>A:  enabled 
        G-->>M: 
    else 
        M->>G: pairing.get(claimId)
        G-->>M: rejected  expired
        Note over M,G: 
    end
```

****  provider token  Agent


## S02 Version negotiation

```mermaid
sequenceDiagram
    participant M as M1 
    participant G as D1 RPC 
    participant P as P 
    Note over M,G: 
    M->>G: connection.hello(protocolVersions)
    G->>P: 
    alt 
        P-->>G: protocolVersion
        G-->>M: hello result + limits
        M->>M: 
        Note over M,G: 
    else 
        P-->>G: 
        G-->>M: error 1000 / UPGRADE_REQUIRED
        M->>M: 
    end
```

**** `jsonrpc: "2.0"` Mobile/Desktop 
 capabilities 

## S03 Checkpoint and activation

```mermaid
sequenceDiagram
    participant M as M2 
    participant L as M3 
    participant J as D3 
    participant E as D4 
    M->>J: agent.sessions.subscribe(sessionId)
    opt  journal 
        J->>E:  listener/observe 
        E-->>J: buffer  chunks/
        J->>J: 
        Note over J,E: 
    end
    J->>J:  C C 
    J-->>M: checkpoint cursor C
    E-->>J:  stream callbacks
    J->>J:  C+1C+2
    Note over M,J:  activate
    loop  live content
        M->>J: checkpoints.read / content.read
        J-->>M: 
    end
    alt 
        M->>L:  cursor C
        L-->>M: 
        M->>J: subscriptions.activate(appliedCursor C)
        J-->>M: activation response
        J-->>M: agent.events(C+1, C+2, ...)
        M->>M:  Ready
    else 
        J-->>M: CHECKPOINT_EXPIRED  RESET_REQUIRED
        M->>L:  staging
        M->>J:  subscribe
    end
```

**** / chunks journal 
 checkpoint C  API


## S04 Send and stream

```mermaid
sequenceDiagram
    participant M as M2 
    participant L as M3 
    participant G as D1 RPC 
    participant E as D4 
    participant D as D5 
    participant J as D3 
    Note over M,J:  Agent 
    M->>L:  commandId C1 
    L-->>M: 
    M->>G: messages.send(id Q1, commandId C1, idleRevision)
    G->>G: schema
    G->>E: 
    E->>D:  + /
    D-->>E: 
    E->>E:  E1
    E-->>G: executionId E1
    G-->>M: Q1 resultaccepted receipt
    loop 
        E-->>J: text / tool / status 
        J->>J:  seq
        J-->>M: agent.events  D1
        M->>M: P reducer 
        M->>L:  + cursor
        L-->>M: 
        M->>J: subscriptions.ack(cursor)
    end
    E->>D: 
    D-->>E: 
    E-->>J: history.committed terminal
    J-->>M: 
    Note over M,D: accepted ACK 
```

**** UI “” C1 


## S05 Lost command receipt

```mermaid
sequenceDiagram
    participant M as M2 
    participant G as D1 RPC 
    participant D as D5 
    participant E as D4 
    M->>G: messages.send(id Q1, commandId C1)
    G->>E:  C1
    E->>D:  C1  E1
    E->>E:  E1
    G--xM: accepted 
    Note over M,G:  C1
    M->>G: commands.get(id Q2, commandId C1)
    G->>D:  device + grantId + C1
    alt 
        D-->>M:  E1  D1
    else 
        D-->>M: NOT_FOUND D1
        M->>G: messages.send(id Q3,  C1 )
        G->>E:  + 
        E-->>M:  D1
    end
    Note over M,E: C1  IDEMPOTENCY_CONFLICT C2 
```

**** “” C1 

## S06 Reconnect and replay

```mermaid
sequenceDiagram
    participant L as M3 
    participant M as M1 + M2 
    participant G as D1 
    participant J as D3 
    Note over M,J:  epoch A / seq 40
    J->>J: Desktop  41  48
    M->>M:  generation
    M->>G: helloauthenticate
    L-->>M:  A / 40 
    M->>J: sessions.subscribe(cursor A / 40)
    J-->>M: replayfromCursor 40watermark 48
    M->>J: subscriptions.activate(cursor 40)
    J-->>M: activation response
    J-->>M: 41  48
    M->>L: 
    M->>J: ACK 48
    J-->>M: 49 ... 
    Note over M,J:  epoch  A ID 
```

****  seq

## S07 Reset and desktop restart

```mermaid
sequenceDiagram
    participant M as M2 
    participant J as D3 
    participant E as D4 
    participant D as D5 
    M->>J: sessions.subscribe(cursor A / 40)
    alt  epoch 41 
        J-->>M: mode checkpointreasoncursor expired
        Note over M,E: Agent 
    else Desktop  epoch B
        E->>D: 
        D-->>E: 
        E->>E:  interrupted
        J-->>M: mode checkpointreasonepoch changed
    end
    M->>J:  S03 
    M->>D:  D1 commands.get 
    D-->>M:  receipt / interrupted
    Note over M,E:  Agent
```

****  epoch  ACK
 Agent 

## S08 Mobile crash

```mermaid
sequenceDiagram
    participant J as D3 
    participant M as M2 reducer 
    participant L as M3 
    J-->>M: agent.events(seq 41)
    M->>M: 
    M->>L:  + cursor 41
    alt 
        Note over M,L:  cursor 40
        L-->>M:  cursor 40
        M->>J:  41 
    else  ACK 
        L-->>M:  cursor 41
        M->>J:  42 
    end
    Note over M,J:  seq 
```

**** “ 41 40”


## S09 Approval race

```mermaid
sequenceDiagram
    participant U as 
    participant M as M2 
    participant G as D1 
    participant E as D4 
    participant D as D5 
    E-->>M: interaction.updated(I1, revision 3) D3
    M->>G: interactions.get(I1)
    G-->>M: revision 3execution E1inputDigest
    M->>M:  commandId
    opt 
        U->>E:  I1 / 
        E->>E:  revision / 
    end
    M->>G: interactions.respond(C1, I1, expectedRevision 3, E1, digest)
    G->>G:  Agent 
    G->>E:  pendingrevision digest
    alt 
        E->>D: 
        E-->>M:  D1/D3
    else 
        E->>D: 
        E-->>M: CONFLICT interaction 
    end
```

****  commandId 
 RPC 

## S10 Cancellation race

```mermaid
sequenceDiagram
    participant M as M2 
    participant G as D1 RPC 
    participant E as D4 
    participant D as D5 
    Note over M,E:  E1 commandId C1
    M->>G: executions.cancel(C1, expectedExecutionId E1)
    G->>E:  Agent  + 
    alt  E1
        E->>D: 
        E->>E:  E1
        E-->>M: command receipt D1
        E-->>M:  execution  D3
    else E1  E2
        E->>D: 
        E-->>M: CONFLICT E2
    end
```

****  RPC 


## S11 Expiry and revocation

```mermaid
sequenceDiagram
    participant M as M1 
    participant G as D1 RPC 
    participant A as D2 
    participant J as D3 
    alt 
        G-->>M: connection.authRequired(expiresAt)
        M->>G: connection.refresh
        G->>A:  enabled 
        A-->>M:  D1
    else 
        M->>G: 
        M->>G: hello authenticate(grantId token)
        G->>A:  enabled 
        A-->>M:  D1
    else  Agent 
        A->>A: 
        A->>G: 
        A->>J: 
        G--xM: 
        M->>G: 
        G-->>M: GRANT_REVOKED
    end
```

****  refresh/ping token 


## S12 Backpressure

```mermaid
sequenceDiagram
    participant E as D4 Agent
    participant J as D3 
    participant H as 
    participant S as  M2
    E-->>J: 
    J-->>H: 
    H->>J:  ACK
    J-->>S:  ACK 
    J->>J: 
    E-->>J: Agent 
    J-->>H: 
    alt 
        S->>J:  ACK
        J-->>S: 
    else 
        J-->>S: subscriptions.resetRequired
        S->>J:  subscribe
    else ACK  epoch 
        S->>J:  ACK
        J-->>S: 
    end
```

****  bulk  TCP 
 reset 

## S13 Relay interruption

```mermaid
sequenceDiagram
    participant M as M1 
    participant R as R Relay
    participant G as D1 Desktop 
    participant J as D3 
    G->>R: 
    M->>R:  Desktop 
    R->>G: 
    Note over M,G:  Agent 
    M->>R:  JSON-RPC
    R->>G: 
    G-->>R: 
    R-->>M: 
    R--xM: 
    J->>J: Desktop  epoch A
    G->>R: 
    M->>G:  Relay 
    M->>J:  D1  A 
    J-->>M:  checkpoint
```

****  Agent Relay  JSON-RPC seq
 epochDesktop 

## Implementation slices

|  |  |  |
|---|---|---|
|  | PM1/D1  RPC  | S02 JSON-RPC //batch |
|  | D3D4D5M2/M3  | S03S04S05S07S08S12 |
|  Desktop  | D1D2 | S01S09S10S11 |
|  | M1M2M3UI | S01  S12 |
| Relay | RM1/D1 reachability adapter | S13 Agent  |


 mock 
