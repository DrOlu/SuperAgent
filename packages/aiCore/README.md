# @cherrystudio/ai-core

SuperAgent AI Core  Vercel AI SDK  AI Provider  AI 

## ✨ 

### 🏗️ 

- ****`models`→ `runtime`
- **** API
- **** TypeScript  AI SDK 
- **** AI SDK 

### 🔌 

- ****
- **** AI SDK  `experimental_transform` 
- ****FirstSequentialParallel 
- ****webSearchproviderTool 

### 🌐  Provider 

- **** Provider 
- **** Provider 

### 🚀 

- ****
- ****
- ****
- **** AI SDK  Provider Registry

### 🔮 

- **Agent ** OpenAI Agents SDK 
- ****
- **** AI SDK 

## 

- 🚀  AI Provider 
- 🔄 
- 🛠️ TypeScript 
- 📦 
- 🌍 webSearch(Openai,Google,Anthropic,xAI)
- 🎯 //
- 🔌  Provider 
- 🧩 
- 📊 

##  Providers

 [AI SDK  providers](https://ai-sdk.dev/providers/ai-sdk-providers)

** Providers:**

- OpenAI
- Anthropic
- Google Generative AI
- OpenAI-Compatible
- xAI (Grok)
- Azure OpenAI
- DeepSeek

** ProvidersAPI:**

- Google Vertex AI
- ...
-  Provider

## 

```bash
npm install @cherrystudio/ai-core ai @ai-sdk/google @ai-sdk/openai
```

### React Native

 React Native  `metro.config.js` 

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

//  @cherrystudio/ai-core 
config.resolver.resolverMainFields = ['react-native', 'browser', 'main']
config.resolver.platforms = ['ios', 'android', 'native', 'web']

module.exports = config
```

 AI SDK provider:

```bash
npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

## 

### 

```typescript
import { AiCore } from '@cherrystudio/ai-core'

//  OpenAI executor
const executor = AiCore.create('openai', {
  apiKey: 'your-api-key'
})

// 
const result = await executor.streamText('gpt-4', {
  messages: [{ role: 'user', content: 'Hello!' }]
})

// 
const response = await executor.generateText('gpt-4', {
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### 

```typescript
import { createOpenAIExecutor } from '@cherrystudio/ai-core'

//  OpenAI executor
const executor = createOpenAIExecutor({
  apiKey: 'your-api-key'
})

//  executor
const result = await executor.streamText('gpt-4', {
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

###  Provider 

```typescript
import { AiCore } from '@cherrystudio/ai-core'

//  AI providers
const openaiExecutor = AiCore.create('openai', { apiKey: 'openai-key' })
const anthropicExecutor = AiCore.create('anthropic', { apiKey: 'anthropic-key' })
const googleExecutor = AiCore.create('google', { apiKey: 'google-key' })
const xaiExecutor = AiCore.create('xai', { apiKey: 'xai-key' })
```

###  Provider 

 providers API 

```typescript
import { registerProvider, AiCore } from '@cherrystudio/ai-core'

//  provider
import { createGroq } from '@ai-sdk/groq'

registerProvider({
  id: 'groq',
  name: 'Groq',
  creator: createGroq,
  supportsImageGeneration: false
})

//  Groq
const groqExecutor = AiCore.create('groq', { apiKey: 'groq-key' })

// 
registerProvider({
  id: 'mistral',
  name: 'Mistral AI',
  import: () => import('@ai-sdk/mistral'),
  creatorFunctionName: 'createMistral'
})

const mistralExecutor = AiCore.create('mistral', { apiKey: 'mistral-key' })
```

## 🔌 

AI Core 

### 

#### webSearchPlugin - 

 AI Provider 

```typescript
import { webSearchPlugin } from '@cherrystudio/ai-core/built-in/plugins'

const executor = AiCore.create('openai', { apiKey: 'your-key' }, [
  webSearchPlugin({
    openai: {
      /* OpenAI  */
    },
    anthropic: { maxUses: 5 },
    google: {
      /* Google  */
    },
    xai: {
      mode: 'on',
      returnCitations: true,
      maxSearchResults: 5,
      sources: [{ type: 'web' }, { type: 'x' }, { type: 'news' }]
    }
  })
])
```

#### loggingPlugin - 



```typescript
import { createLoggingPlugin } from '@cherrystudio/ai-core/built-in/plugins'

const executor = AiCore.create('openai', { apiKey: 'your-key' }, [
  createLoggingPlugin({
    logLevel: 'info',
    includeParams: true,
    includeResult: false
  })
])
```

### 



```typescript
import { definePlugin } from '@cherrystudio/ai-core'

const customPlugin = definePlugin({
  name: 'custom-plugin',
  enforce: 'pre', // 'pre' | 'post' | undefined

  // 
  onRequestStart: async (context) => {
    console.log(`Starting request for model: ${context.modelId}`)
  },

  // 
  transformParams: async (params, context) => {
    // 
    if (params.messages) {
      params.messages.unshift({
        role: 'system',
        content: 'You are a helpful assistant.'
      })
    }
    return params
  },

  // 
  transformResult: async (result, context) => {
    // 
    if (result.text) {
      result.metadata = {
        processedAt: new Date().toISOString(),
        modelId: context.modelId
      }
    }
    return result
  }
})

// 
const executor = AiCore.create('openai', { apiKey: 'your-key' }, [customPlugin])
```

###  AI SDK  Provider 

> https://ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry

 provider  AI SDK  `createProviderRegistry`  provider 

#### 

```typescript
import { createClient } from '@cherrystudio/ai-core'
import { createProviderRegistry } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

// 1.  AI SDK 
export const registry = createProviderRegistry({
  // register provider with prefix and default setup:
  anthropic,

  // register provider with prefix and custom setup:
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
})

// 2. client,'openai'providerId(provider)
const client = PluginEnabledAiClient.create('openai', {
  apiKey: process.env.OPENAI_API_KEY
})

// 3. 1
const result1 = await client.streamText('gpt-4', {
  messages: [{ role: 'user', content: 'Hello with built-in logic!' }]
})

// 4. 2
const result2 = await client.streamText({
  model: registry.languageModel('openai:gpt-4'),
  messages: [{ role: 'user', content: 'Hello with custom registry!' }]
})

// 5. 
await client.generateObject({
  model: registry.languageModel('openai:gpt-4'),
  schema: z.object({ name: z.string() }),
  messages: [{ role: 'user', content: 'Generate a user' }]
})

await client.streamObject({
  model: registry.languageModel('anthropic:claude-3-opus-20240229'),
  schema: z.object({ items: z.array(z.string()) }),
  messages: [{ role: 'user', content: 'Generate a list' }]
})
```

#### 

 SuperAgent 

```typescript
import { PluginEnabledAiClient } from '@cherrystudio/ai-core'
import { createProviderRegistry } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

// 1. 
const client = PluginEnabledAiClient.create(
  'openai',
  {
    apiKey: process.env.OPENAI_API_KEY
  },
  [LoggingPlugin, RetryPlugin]
)

// 2. 
const registry = createProviderRegistry({
  openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  anthropic: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
})

// 3. 1 + 
await client.streamText('gpt-4', {
  messages: [{ role: 'user', content: 'Hello with plugins!' }]
})

// 4. 2 + 
await client.streamText({
  model: registry.languageModel('anthropic:claude-3-opus-20240229'),
  messages: [{ role: 'user', content: 'Hello from Claude!' }]
})

// 5. 
await client.generateObject({
  model: registry.languageModel('openai:gpt-4'),
  schema: z.object({ name: z.string() }),
  messages: [{ role: 'user', content: 'Generate a user' }]
})

await client.streamObject({
  model: registry.languageModel('openai:gpt-4'),
  schema: z.object({ items: z.array(z.string()) }),
  messages: [{ role: 'user', content: 'Generate a list' }]
})
```

#### 

- ****
- **** AI SDK  `createProviderRegistry` API
- ****
- ****
- ****

## 📚 

- [Vercel AI SDK ](https://ai-sdk.dev/)
- [SuperAgent ](https://github.com/DrOlu/SuperAgent)
- [AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers)

## 

- 🔮  Agent 
- 🔮 
- 🔮 
- 🔮 

## 📄 License

MIT License -  [LICENSE](https://github.com/DrOlu/SuperAgent/blob/main/LICENSE) 

---

**SuperAgent AI Core** -  AI  🚀
