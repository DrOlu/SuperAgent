# WebSearch Main Service Architecture

## 1. 

 Main-side WebSearch service 

 `searchUrls` / `searchKeywords` 

1. provider 
2. capability  provider 
3. 

 provider id  `KeywordSearchProviderId`  `UrlSearchProviderId`“provider ”“”Jina  Jina  URL 

 Main-side WebSearch  `Provider + Capability` 

---

## 2. 

### Provider

Provider  WebSearch 

Provider 

1.  id
2. 
3. provider  `api` / `mcp`
4. API key
5. capability endpoint
6. provider-specific  engines / basic auth

Provider  provider  capability

### Capability

Capability  provider 

 capability

1. `searchKeywords`
2. `fetchUrls`

Capability provider driver endpoint 

### `searchKeywords`

`searchKeywords`  query  Web 

 keyword query

 `WebSearchResponse`

1. `query`
2. `results[]`
3.  result  `title` / `content` / `url`

 provider

1. Zhipu
2. Tavily
3. Searxng
4. Exa
5. Exa MCP
6. Bocha
7. Querit
8. Jina

### `fetchUrls`

`fetchUrls`  URL 

 URL

 SERP  URL 

 provider

1. Fetch
2. Jina

 `searchUrls`  URL 

### Request

Request  Main-side WebSearch 

 request  URL  `searchKeywords`  `fetchUrls`

---

## 3. 

### 3.1  Provider + Capability



```text
Provider
  -> capabilities[]
      -> searchKeywords
      -> fetchUrls
```

 provider id 

1.  `KEYWORD_SEARCH_PROVIDER_IDS` 
2.  `URL_SEARCH_PROVIDER_IDS`  URL

 provider  Jina  provider

### 3.2 Main service 

Main-side service 

```typescript
searchKeywords({
  providerId?,
  keywords
})

fetchUrls({
  providerId?,
  urls
})
```



1. `searchKeywords`  `fetchUrls`  AI SDK tools 
2. tool description 
3. service request  `capability` 
4. WebSearchService  `requestId`lifecycleabort  UI  tool block / tool runtime 
5. service  fanout / merge / blacklist / post process 



1. “” `searchKeywords({ keywords: [''] })`
2. “ xxx.com ” `fetchUrls({ urls: ['https://xxx.com'] })`
3. 
4. `providerId`  service  capability  provider preference

### 3.3 Driver 

Provider driver  `search(query)` 



1. `searchKeywords(input, config, httpOptions?)`
2. `fetchUrls(input, config, httpOptions?)`

Driver  capabilityservice  provider capability registry 

### 3.4 Jina  provider

Jina  provider provider

 provider id

```text
jina
```

Jina  capability

1. `searchKeywords`
2. `fetchUrls`

Jina  API key endpoint

Jina  Reader 

1. `https://r.jina.ai`  URL 
2. `https://s.jina.ai`  SERP



1. <https://jina.ai/reader/>
2. <https://github.com/jina-ai/reader>

### 3.5  v2 

 v2 



1. `jina-reader`  `jina`
2.  `searchUrls` request type 
3.  provider id 
4. v2  preference 

 v1  v2  v1  `src/main/data/migration/v2/`  migrator 

 v2  Main service 

---

## 4. Shared Contract

WebSearch preset  File Processing preset  layered preset pattern

1. preset  `src/shared/data/presets/`
2.  override delta
3. runtime config  preset  override merge 
4. capability  preset capability  API 

File Processing 

```typescript
capabilities: [
  {
    feature: 'document_to_markdown',
    inputs: ['document'],
    output: 'markdown',
    apiHost: 'https://mineru.net',
    modelId: 'pipeline'
  }
]
```

WebSearch  `defaultApiHost` / `capabilityApiHosts` 

 WebSearch  File Processing  `inputs` / `output` File Processing  processor feature WebSearch  capability  `WebSearchResponse`

### 4.1 Capability 

Shared contract  capability

```typescript
type WebSearchCapability = 'searchKeywords' | 'fetchUrls'
```

### 4.2 Request 

 request contract

```typescript
type WebSearchSearchKeywordsRequest = {
  providerId?: WebSearchProviderId
  keywords: string[]
}

type WebSearchFetchUrlsRequest = {
  providerId?: WebSearchProviderId
  urls: string[]
}
```



1. `keywords`  keyword query
2. `urls`  URL
3. `searchKeywords` request  URL 
4. `fetchUrls` request  keyword 
5. `providerId`  AI  provider

### 4.3 Default Provider Preference

WebSearch  provider  File Processing  feature default  capability  default preference

 preference keys

```typescript
'chat.web_search.default_search_keywords_provider': WebSearchProviderId | null
'chat.web_search.default_fetch_urls_provider': WebSearchProviderId | null
```



1. `searchKeywords`  `providerId`  `chat.web_search.default_search_keywords_provider`
2. `fetchUrls`  `providerId`  `chat.web_search.default_fetch_urls_provider`
3. default value  `null` service  provider
4. request  `providerId`  provider 
5.  provider  default provider  capability service  fallback
6.  `chat.web_search.default_provider`  preference 

### 4.4 Response 

 response

```typescript
type WebSearchResult = {
  title: string
  content: string
  url: string
  sourceInput: string
}

type WebSearchResponse = {
  query?: string
  providerId: WebSearchProviderId
  capability: WebSearchCapability
  inputs: string[]
  results: WebSearchResult[]
}
```

`query`  capability 

1. `searchKeywords` keyword query 
2. `fetchUrls` URL 

`results`  provider 

Trace metadata

1. `providerId`  tool call  provider default provider 
2. `capability`  tool call `searchKeywords`  `fetchUrls`
3. `inputs`  tool call 
4. `sourceInput`  result  keyword  URL tool call / query 
5.  contract  `warnings``failedInputs`

`requestId`  WebSearch  contract

1.  tool  tool runtime / message block  tool call id 
2.  WebSearch tool  assistant turn WebSearch  request
3. Abortrunningdoneerror  tool block lifecycle 
4. WebSearchService  capability  UI 

 WebSearch request / response / status  `requestId`

`query`  request input  provider  query

1.  trim  URL 
2.  Exa `autopromptString`Bocha `originalQuery`Tavily  `query`  provider response 
3.  `searchWithTime`  query
4.  `fetchUrls``query`  URL URL  provider  URL  result  `url` 

 provider  query provider metadata  `query` 

### 4.5 Provider Definition

Provider definition  capability  endpoint 

 File Processing preset

```typescript
type WebSearchProviderFeatureCapability =
  | {
      feature: 'searchKeywords'
      apiHost?: string
    }
  | {
      feature: 'fetchUrls'
      apiHost?: string
    }

type WebSearchProviderPresetConfig = {
  name: string
  type: WebSearchProviderType
  capabilities: readonly WebSearchProviderFeatureCapability[]
}

type WebSearchProviderPreset = {
  id: WebSearchProviderId
} & WebSearchProviderPresetConfig
```



1.  `feature`  discriminant File Processing  capability schema 
2. `apiHost`  capability  endpoint provider  `defaultApiHost`
3.  `inputs` / `output` `searchKeywords`  keyword query`fetchUrls`  URL `WebSearchResponse`

 endpoint  provider endpoint  capability 

 Jina  endpoint provider capability  endpoint

```text
jina.capabilities[feature=searchKeywords].apiHost -> https://s.jina.ai
jina.capabilities[feature=fetchUrls].apiHost      -> https://r.jina.ai
```

Preset map 

```typescript
export const WEB_SEARCH_PROVIDER_PRESET_MAP = {
  jina: {
    name: 'Jina',
    type: 'api',
    capabilities: [
      {
        feature: 'searchKeywords',
        apiHost: 'https://s.jina.ai'
      },
      {
        feature: 'fetchUrls',
        apiHost: 'https://r.jina.ai'
      }
    ]
  }
} as const satisfies Record<WebSearchProviderId, WebSearchProviderPresetConfig>
```

### 4.6 Provider Override

Provider override  capability-specific endpoint



1. API keys  provider
2. API host  capability override
3. engines / basic auth  provider  provider  capability 
4. override  preset 



```typescript
type WebSearchProviderCapabilityOverride = {
  apiHost?: string
}

type WebSearchProviderOverride = {
  apiKeys?: string[]
  capabilities?: Partial<Record<WebSearchCapability, WebSearchProviderCapabilityOverride>>
  engines?: string[]
  basicAuthUsername?: string
  basicAuthPassword?: string
}
```

`apiHost`  capability-aware shape

Merged provider config  File Processing  capability array capability override  Record

```typescript
type ResolvedWebSearchProvider = WebSearchProviderPreset & {
  apiKeys?: string[]
  capabilities: WebSearchProviderFeatureCapability[]
  engines?: string[]
  basicAuthUsername?: string
  basicAuthPassword?: string
}
```

merge 

1.  provider id  preset
2.  provider override
3. provider-level  merge
4. capability override  `feature` merge  preset  `capabilities[]`
5.  preset capabilities  override capability  schema 

---

## 5. Main-side 



```text
Caller
  -> WebSearchService.searchKeywords(request)
     or WebSearchService.fetchUrls(request)
  -> resolve providerId from request override or capability default preference
  -> resolve provider config
  -> validate provider supports the method capability
  -> create provider driver
  -> fanout request keywords/urls with matching driver method
  -> Promise.allSettled()
  -> reject immediately on AbortError
  -> log partial failures
  -> require at least one successful keyword or URL
  -> merge successful responses and keep request keywords/urls as response.query
  -> apply blacklist
  -> post process
  -> WebSearchResponse
```

### 5.1 Fanout

`keywords` / `urls`  fanout 

 keyword  URL  provider capability 

1. `searchKeywords`  driver  `searchKeywords(input, ...)`
2. `fetchUrls`  driver  `fetchUrls(input, ...)`

 keyword  URL  successful results 

 helper 

```typescript
private runCapability({
  providerId,
  feature,
  inputs
})
```

 helper  AI SDK tools  service contract

### 5.2 

 Main-side 

1.  AbortError request  abort 
2.  keyword  URL  request 
3.  keyword  URL  request 
4.  shared cache  UI service 
5.  `warnings` / `failedInputs` response contract 

### 5.3 UI 

WebSearch tool 

 UI 

1.  `searchKeywords` / `fetchUrls` tool call  `WebSearchResponse`
2. Tool execution UI  MCP / tool block UI running / done / error
3. “” assistant turn  web search/fetch tool outputs
4. inline citation / sources 
5. `searchKeywords`  `fetchUrls`  `{ title, content, url }[]`UI  provider 



1.  assistant message / assistant turn tool call
2.  tool call  query  provider 
3.  URL 
4. `searchKeywords`  `fetchUrls` 
5.  tool call

 `chat.web_search.active_searches``active_searches` 

#### `chat.web_search.active_searches`

 Main-side WebSearch  `chat.web_search.active_searches`

 `chat.web_search.active_searches`  UI 

1. Renderer `CitationBlock`  processing spinner 
2.  Renderer WebSearch service  `fetch_complete` / `partial_failure` / `cutoff`
3.  Main-side prototype  Main  UI spinner

Tool  shared cache 

1. AI SDK tool call 
2. `fetch_complete`  tool result  sources count  tool block 
3. `partial_failure`  service  fanout  UI 
4. `cutoff`  cache key 



1.  assistant turn  tool blocks  `WebSearchResponse.results`
2. WebSearchService  `chat.web_search.active_searches`
3. WebSearchService  `WebSearchStatus` / `WebSearchPhase`
4. UI  AI SDK tool invocation state  message/tool block state 
5.  UI  tool progress eventcallback  tool block progress  shared cache  service contract

 Renderer WebSearch service  AI  Redux slice  `chat.web_search.active_searches` Main-side WebSearch 

### 5.4 Blacklist  Post Processing



```text
merge successful responses
  -> blacklist filter
  -> post processing
```



1. blacklist  provider  URL
2. cutoff 

---

## 6. Provider Capability Matrix

 capability matrix

| Provider | ID | searchKeywords | fetchUrls | Notes |
| --- | --- | --- | --- | --- |
| Zhipu | `zhipu` | Yes | No | API keyword search |
| Tavily | `tavily` | Yes | No | API keyword search |
| Searxng | `searxng` | Yes | No |  URL  `searchKeywords` |
| Exa | `exa` | Yes | No | API keyword search |
| Exa MCP | `exa-mcp` | Yes | No | MCP-style keyword search |
| Bocha | `bocha` | Yes | No | API keyword search |
| Querit | `querit` | Yes | No | API keyword search |
| Fetch | `fetch` | No | Yes |  URL  |
| Jina | `jina` | Yes | Yes | `s.jina.ai` `r.jina.ai`  URL |

Searxng  capability  `searchKeywords`Capability  provider 

---

## 7. Settings  Check 

Settings  provider  provider  capability



1.  provider 
2. API key  provider
3. endpoint  capability 
4. Jina  `searchKeywords`  `fetchUrls`  endpoint

Provider check  capability 



1. `searchKeywords`  test query `test query`
2. `fetchUrls`  URL `https://example.com`



1.  capability provider check 
2.  capability  capability endpoint 

---

## 8. Renderer / aiCore 

 WebSearch  Main-side service

1. Renderer AI tools  preload IPC  `WebSearchService.searchKeywords()` / `WebSearchService.fetchUrls()`
2.  Renderer `WebSearchService`  Renderer provider drivers 
3. UI  WebSearch  `assistant.enableWebSearch`
4.  web search  provider native tool
5.  web search  `builtin_web_search`  `builtin_fetch_urls`  external tools
6. UI  external web search  provider  API key / API host WebSearch provider 



1. tracing / span 
2. Main-side `rag` post processing 
3.  preference 
4. `searchWithTime` 
5.  `chat.web_search.active_searches`

`searchWithTime`  Renderer WebSearch  Main-side runtime contract

---

## 9. 



### 9.1 Provider Registry / Factory



1.  provider  capability matrix
2.  capability 
3. Jina  `searchKeywords`  `fetchUrls`

### 9.2 Provider Drivers



1. Jina `fetchUrls`  `https://r.jina.ai` endpoint
2. Jina `searchKeywords`  `https://s.jina.ai` endpoint
3. Fetch  `fetchUrls`
4. Keyword-only provider  `fetchUrls`
5. URL `fetchUrls` 

### 9.3 WebSearchService



1. `searchKeywords()` fanout 
2. `fetchUrls()` fanout 
3.  `providerId`  capability default provider
4. default provider  `null` 
5.  provider  capability 
6. response  `providerId` / `capability` / `inputs`  result  `sourceInput`
7. 
8. 
9. AbortError 
10.  tool call  `WebSearchResponse.results`  assistant turn 
11. blacklist  post processing 

### 9.4 Settings Check



1.  capability provider  capability 
2. capability check  capability
3. Jina  endpoint 

---

## 10. 

Main-side WebSearch 

```text
Shared Provider Preset
  -> provider capabilities
  -> capability endpoint defaults

Preference Override
  -> provider credentials
  -> capability endpoint overrides

Main WebSearchService
  -> searchKeywords(providerId?, keywords)
  -> fetchUrls(providerId?, urls)
  -> provider capability validation
  -> provider driver capability method
  -> result normalization
  -> blacklist
  -> post processing
```

 WebSearch 

1. Provider “”
2. Capability “”
3. Service tools “ AI ”
4. Request “”

 Jina  provider URL 
