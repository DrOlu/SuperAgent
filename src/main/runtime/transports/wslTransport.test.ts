import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const processMocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
  execFileP: vi.fn(),
}))

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  Object.defineProperty(processMocks.execFile, Symbol.for('nodejs.util.promisify.custom'), {
    value: processMocks.execFileP,
    configurable: true,
  })
  return { ...actual, spawn: processMocks.spawn, execFile: processMocks.execFile }
})
vi.mock('../../logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../runtimeArtifacts', () => ({
  ensureLocalTarball: vi.fn(),
  isRuntimeDevMode: () => false,
  isRuntimeTarget: (target: string) => ['linux-x64', 'linux-arm64'].includes(target),
  localTarballIfPresent: () => null,
  releaseUrl: () => 'https://example.invalid/runtime.tgz',
  tarballHash: vi.fn(),
  localRuntimeBundlePath: () => null,
}))

import { WslTransport } from './wslTransport'

class FakeChild extends EventEmitter {
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  kill = vi.fn(() => true)
}

function execResult(stdout = '', stderr = ''): { stdout: string; stderr: string } {
  return { stdout, stderr }
}

beforeEach(() => {
  processMocks.spawn.mockReset()
  processMocks.execFileP.mockReset().mockImplementation(async (_file: string, args: string[]) => {
    if (args.includes('uname')) return execResult('x86_64\n')
    if (args.includes('echo $HOME')) return execResult('/home/tester\n')
    return execResult('')
  })
})

describe('WslTransport', () => {
  it('constructs distro-scoped probe commands and caches platform/home discovery', async () => {
    const transport = new WslTransport({ distro: 'Ubuntu-24.04', root: '/work', id: 'runtime-1' })

    await expect(transport.isInstalled('1.2.3')).resolves.toBe(false)
    await expect(transport.isInstalled('1.2.3')).resolves.toBe(false)

    expect(processMocks.execFileP.mock.calls.filter(([, args]) => args.includes('uname'))).toHaveLength(1)
    expect(processMocks.execFileP.mock.calls.filter(([, args]) => args.includes('echo $HOME'))).toHaveLength(1)
    for (const [file, args] of processMocks.execFileP.mock.calls) {
      expect(file).toBe('wsl.exe')
      expect(args.slice(0, 3)).toEqual(['-d', 'Ubuntu-24.04', '-e'])
    }
    expect(processMocks.execFileP).toHaveBeenCalledWith('wsl.exe', [
      '-d', 'Ubuntu-24.04', '-e', 'sh', '-c',
      expect.stringContaining("'/home/tester/.cate/runtime/1.2.3/linux-x64'/runtime/bin/node"),
    ])
  })

  it('forwards frames and process events, with all daemon launch arguments kept as argv', async () => {
    const child = new FakeChild()
    processMocks.spawn.mockReturnValue(child)
    const transport = new WslTransport({
      distro: 'Ubuntu',
      root: "/work/it's safe",
      id: 'runtime-2',
      exclusions: ['node_modules', '.git'],
      idleSuspend: true,
    })
    await transport.isInstalled('2.0.0')

    const channel = await transport.launch()

    expect(processMocks.spawn).toHaveBeenCalledWith('wsl.exe', [
      '-d', 'Ubuntu', '-e',
      '/home/tester/.cate/runtime/2.0.0/linux-x64/runtime/bin/node',
      '/home/tester/.cate/runtime/2.0.0/linux-x64/runtime.cjs',
      '--root', "/work/it's safe",
      '--id', 'runtime-2',
      '--exclude', 'node_modules,.git',
      '--idle-suspend',
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    const writes: Buffer[] = []
    child.stdin.on('data', (chunk) => writes.push(chunk))
    channel.write('{"id":1}\n')
    expect(Buffer.concat(writes).toString()).toBe('{"id":1}\n')

    const data = vi.fn()
    const stderr = vi.fn()
    const close = vi.fn()
    channel.onData(data)
    channel.onStderr?.(stderr)
    channel.onClose(close)
    child.stdout.write('response\n')
    child.stderr.write('diagnostic')
    child.emit('close', 17)
    expect(data.mock.calls[0][0].toString()).toBe('response\n')
    expect(stderr.mock.calls[0][0].toString()).toBe('diagnostic')
    expect(close).toHaveBeenCalledWith({ code: 17 })

    channel.kill()
    expect(child.kill).toHaveBeenCalledTimes(1)
    child.exitCode = 17
    expect(() => channel.write('late\n')).toThrow('Runtime stdin is closed')
  })

  it('dispose kills the active child once and is idempotent', async () => {
    const child = new FakeChild()
    processMocks.spawn.mockReturnValue(child)
    const transport = new WslTransport({ distro: 'Ubuntu', root: '/work', id: 'runtime-3' })
    await transport.launch()

    await transport.dispose()
    await transport.dispose()

    expect(child.kill).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported distro architectures before launch', async () => {
    processMocks.execFileP.mockResolvedValueOnce(execResult('riscv64\n'))
    const transport = new WslTransport({ distro: 'Experimental', root: '/work', id: 'runtime-4' })

    await expect(transport.isInstalled('1.0.0')).rejects.toThrow('Unsupported WSL arch: "riscv64"')
    expect(processMocks.spawn).not.toHaveBeenCalled()
  })
})
