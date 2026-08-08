import { describe, expect, it, vi } from 'vitest'

import { AsyncInitializer } from '../asyncInitializer'

describe('AsyncInitializer', () => {
  it('should initialize value lazily on first get', async () => {
    const mockFactory = vi.fn().mockResolvedValue('test-value')
    const initializer = new AsyncInitializer(mockFactory)

    // factory 
    expect(mockFactory).not.toHaveBeenCalled()

    //  get
    const result = await initializer.get()

    expect(mockFactory).toHaveBeenCalledTimes(1)
    expect(result).toBe('test-value')
  })

  it('should cache value and return same instance on subsequent calls', async () => {
    const mockFactory = vi.fn().mockResolvedValue('test-value')
    const initializer = new AsyncInitializer(mockFactory)

    //  get
    const result1 = await initializer.get()
    const result2 = await initializer.get()
    const result3 = await initializer.get()

    // factory 
    expect(mockFactory).toHaveBeenCalledTimes(1)

    // 
    expect(result1).toBe('test-value')
    expect(result2).toBe('test-value')
    expect(result3).toBe('test-value')
  })

  it('should handle concurrent calls properly', async () => {
    let resolveFactory: (value: string) => void
    const factoryPromise = new Promise<string>((resolve) => {
      resolveFactory = resolve
    })
    const mockFactory = vi.fn().mockReturnValue(factoryPromise)

    const initializer = new AsyncInitializer(mockFactory)

    //  get
    const promise1 = initializer.get()
    const promise2 = initializer.get()
    const promise3 = initializer.get()

    // factory 
    expect(mockFactory).toHaveBeenCalledTimes(1)

    //  promise
    resolveFactory!('concurrent-value')

    const results = await Promise.all([promise1, promise2, promise3])
    expect(results).toEqual(['concurrent-value', 'concurrent-value', 'concurrent-value'])
  })

  it('should handle and cache errors', async () => {
    const error = new Error('Factory error')
    const mockFactory = vi.fn().mockRejectedValue(error)
    const initializer = new AsyncInitializer(mockFactory)

    // 
    await expect(initializer.get()).rejects.toThrow('Factory error')
    await expect(initializer.get()).rejects.toThrow('Factory error')

    // factory 
    expect(mockFactory).toHaveBeenCalledTimes(1)
  })

  it('should not retry after failure', async () => {
    // 
    const error = new Error('Initialization failed')
    const mockFactory = vi.fn().mockRejectedValue(error)
    const initializer = new AsyncInitializer(mockFactory)

    // 
    await expect(initializer.get()).rejects.toThrow('Initialization failed')

    // 
    await expect(initializer.get()).rejects.toThrow('Initialization failed')

    // factory 
    expect(mockFactory).toHaveBeenCalledTimes(1)
  })
})
