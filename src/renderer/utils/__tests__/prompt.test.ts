import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@renderer/ipc', () => ({ ipcApi: { request: mocks.request } }))

import { replacePromptVariables } from '../prompt'

// Per-route results the mocked `ipcApi.request` resolves (or rejects) with.
let deviceTypeResult: string | Error = 'macOS'
let appInfoResult: { arch: string } | Error = { arch: 'darwin64' }

const settle = (value: unknown) => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value))

/** Control the `system.get_device_type` route on the ipcApi facade. */
const mockDeviceType = (result: string | Error) => {
  deviceTypeResult = result
}

/** Control the `app.get_info` route on the ipcApi facade. */
const mockAppInfo = (result: { arch: string } | Error) => {
  appInfoResult = result
}

// `replacePromptVariables` only needs the model name string. The tests used
// to pass through a full Assistant just to read `.model.name`; the v2 model
// lookup happens at the call site, so the helper is a name pair only.
const createMockAssistant = (_name: string, modelName: string) => ({ modelName })

describe('prompt', () => {
  const mockDate = new Date('2024-01-01T12:00:00Z')

  beforeEach(() => {
    //  mocks
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)

    //  mock 
    deviceTypeResult = 'macOS'
    appInfoResult = { arch: 'darwin64' }
    mocks.request.mockImplementation((route: string) => {
      if (route === 'system.get_device_type') return settle(deviceTypeResult)
      if (route === 'app.get_info') return settle(appInfoResult)
      return Promise.resolve(undefined)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('buildSystemPrompt', () => {
    it('should replace all variables correctly with strict equality', async () => {
      const userPrompt = `
:
  - : {{datetime}};
  - : {{system}};
  - : {{arch}};
  - : {{language}};
  - : {{model_name}};
  - : {{username}};
`
      const assistant = createMockAssistant('MyAssistant', 'Super-Model-X')
      const result = await replacePromptVariables(userPrompt, assistant.modelName)
      const expectedPrompt = `
:
  - : ${mockDate.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })};
  - : macOS;
  - : darwin64;
  - : zh-CN;
  - : Super-Model-X;
  - : MockUser;
`
      expect(result).toEqual(expectedPrompt)
    })

    it('should handle API errors gracefully and use fallback values', async () => {
      mockDeviceType(new Error('API Error'))
      mockAppInfo(new Error('API Error'))

      const userPrompt = 'System: {{system}}, Architecture: {{arch}}'
      const result = await replacePromptVariables(userPrompt)
      const expectedPrompt = 'System: Unknown System, Architecture: Unknown Architecture'
      expect(result).toEqual(expectedPrompt)
    })

    it('should handle non-string input gracefully', async () => {
      const result = await replacePromptVariables(null as any)
      expect(result).toBe(null)
    })
  })
})
