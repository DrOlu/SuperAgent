import { loggerService } from '@logger'
import { uuid } from '@renderer/utils/uuid'
import { IpcChannel } from '@shared/IpcChannel'

const logger = loggerService.withContext('PyodideService')

const SERVICE_CONFIG = {
  WORKER: {
    MAX_INIT_RETRY: 5, // 
    REQUEST_TIMEOUT: {
      INIT: 30000, // 30 
      RUN: 60000 // 60 
    }
  }
}

// 
export interface PyodideOutput {
  result: any
  text: string | null
  error: string | null
  image?: string
}

export interface PyodideExecutionResult {
  text: string
  image?: string
}

/**
 * Pyodide Web Worker 
 */
class PyodideService {
  private worker: Worker | null = null
  private initPromise: Promise<void> | null = null
  private initRetryCount: number = 0
  private resolvers: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map()

  /**
   *  Pyodide Worker
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }
    if (this.worker) {
      return Promise.resolve()
    }
    if (this.initRetryCount >= SERVICE_CONFIG.WORKER.MAX_INIT_RETRY) {
      return Promise.reject(new Error('Pyodide worker initialization failed too many times'))
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      //  worker
      import('../workers/pyodide.worker?worker')
        .then((WorkerModule) => {
          this.worker = new WorkerModule.default()

          // 
          this.worker.onmessage = this.handleMessage.bind(this)

          // 
          const timeout = setTimeout(() => {
            this.worker = null
            this.initPromise = null
            this.initRetryCount++
            reject(new Error('Pyodide initialization timeout'))
          }, SERVICE_CONFIG.WORKER.REQUEST_TIMEOUT.INIT)

          // 
          const initHandler = (event: MessageEvent) => {
            if (event.data?.type === 'initialized') {
              clearTimeout(timeout)
              this.worker?.removeEventListener('message', initHandler)
              this.initRetryCount = 0
              this.initPromise = null
              resolve()
            } else if (event.data?.type === 'init-error') {
              clearTimeout(timeout)
              this.worker?.removeEventListener('message', initHandler)
              this.worker?.terminate()
              this.worker = null
              this.initPromise = null
              this.initRetryCount++
              reject(new Error(`Pyodide initialization failed: ${event.data.error}`))
            }
          }

          this.worker.addEventListener('message', initHandler)
        })
        .catch((error) => {
          this.worker = null
          this.initPromise = null
          this.initRetryCount++
          reject(new Error(`Failed to load Pyodide worker: ${error instanceof Error ? error.message : String(error)}`))
        })
    })

    return this.initPromise
  }

  /**
   *  Worker 
   */
  private handleMessage(event: MessageEvent): void {
    const { type, error } = event.data

    //  Worker 
    if (type === 'system-error') {
      logger.error(error)
      return
    }

    // 
    if (type === 'initialized' || type === 'init-error') {
      return
    }

    const { id, output } = event.data

    // 
    const resolver = this.resolvers.get(id)
    if (resolver) {
      this.resolvers.delete(id)
      resolver.resolve(output)
    }
  }

  /**
   * Python
   * @param script Python
   * @param context 
   * @param timeout 
   * @returns 
   */
  public async runScript(
    script: string,
    context: Record<string, any> = {},
    timeout: number = SERVICE_CONFIG.WORKER.REQUEST_TIMEOUT.RUN
  ): Promise<PyodideExecutionResult> {
    // Pyodide
    try {
      await this.initialize()
    } catch (error: unknown) {
      logger.error('Pyodide initialization failed, cannot execute Python code', error as Error)
      const text = `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
      return { text }
    }

    if (!this.worker) {
      const text = 'Internal error: Pyodide worker is not initialized'
      return { text }
    }

    try {
      const output = await new Promise<PyodideOutput>((resolve, reject) => {
        const id = uuid()

        // 
        const timeoutId = setTimeout(() => {
          this.resolvers.delete(id)
          reject(new Error('Python execution timed out'))
        }, timeout)

        this.resolvers.set(id, {
          resolve: (output) => {
            clearTimeout(timeoutId)
            resolve(output)
          },
          reject: (error) => {
            clearTimeout(timeoutId)
            reject(error)
          }
        })

        this.worker?.postMessage({
          id,
          python: script,
          context
        })
      })

      return { text: this.formatOutput(output), image: output.image }
    } catch (error: unknown) {
      const text = `Internal error: ${error instanceof Error ? error.message : String(error)}`
      return { text }
    }
  }

  /**
   *  Pyodide 
   */
  public formatOutput(output: PyodideOutput): string {
    let displayText = ''

    // 
    if (output.text) {
      displayText = output.text.trim()
    }

    // 
    if (!displayText && output.result !== null && output.result !== undefined) {
      if (typeof output.result === 'object' && output.result.__error__) {
        displayText = `Result Error: ${output.result.details}`
      } else {
        try {
          displayText =
            typeof output.result === 'object' ? JSON.stringify(output.result, null, 2) : String(output.result)
        } catch (e) {
          displayText = `Result formatting failed: ${String(e)}`
        }
      }
    }

    // 
    if (output.error) {
      if (displayText) displayText += '\n\n'
      displayText += output.error.trim()
    }

    // 
    if (!displayText) {
      displayText = 'Execution completed with no output.'
    }

    return displayText
  }

  /**
   *  Pyodide Worker
   *  Worker 
   * 
   */
  public async resetWorker(): Promise<void> {
    logger.verbose('Resetting Pyodide worker...')
    this.terminate()
    try {
      await this.initialize()
      logger.verbose('Pyodide worker has been reset successfully.')
    } catch (error) {
      logger.error('Failed to re-initialize Pyodide worker after reset.', error as Error)
      throw error
    }
  }

  /**
   *  Pyodide Worker 
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.initPromise = null
      this.initRetryCount = 0

      // 
      this.resolvers.forEach((resolver) => {
        resolver.reject(new Error('Worker terminated'))
      })
      this.resolvers.clear()
    }
  }
}

// 
export const pyodideService = new PyodideService()

// Set up IPC handler for main process requests
if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
  interface PythonExecutionRequest {
    id: string
    script: string
    context: Record<string, any>
    timeout: number
  }

  interface PythonExecutionResponse {
    id: string
    result?: string
    error?: string
  }

  window.electron.ipcRenderer.on(IpcChannel.Python_ExecutionRequest, async (_, request: PythonExecutionRequest) => {
    try {
      const { text } = await pyodideService.runScript(request.script, request.context, request.timeout)
      const response: PythonExecutionResponse = {
        id: request.id,
        result: text
      }
      window.electron.ipcRenderer.send(IpcChannel.Python_ExecutionResponse, response)
    } catch (error: unknown) {
      const response: PythonExecutionResponse = {
        id: request.id,
        error: error instanceof Error ? error.message : String(error)
      }
      window.electron.ipcRenderer.send(IpcChannel.Python_ExecutionResponse, response)
    }
  })
}
