import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sshModule = vi.hoisted(() => ({ makeClient: vi.fn() }))

vi.mock('ssh2', () => ({
  Client: class {
    constructor() { return sshModule.makeClient() }
  },
}))
vi.mock('../sshKnownHosts', () => ({
  hostKeyId: vi.fn(),
  verifyAndPinHostKey: vi.fn(),
}))
vi.mock('../../logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../runtimeArtifacts', () => ({
  ensureLocalTarball: vi.fn(),
  isRuntimeDevMode: () => false,
  isRuntimeTarget: (target: string) => ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64'].includes(target),
  localTarballIfPresent: () => null,
  releaseUrl: () => 'https://example.invalid/runtime.tgz',
  tarballHash: vi.fn(),
  localRuntimeBundlePath: () => null,
}))

import { SshTransport } from './sshTransport'

type ConnectMode = 'ready' | 'authentication-error'

class FakeChannel extends EventEmitter {
  stderr = new EventEmitter()
  write = vi.fn()
  close = vi.fn()
}

let connectMode: ConnectMode
let launchError: Error | null
let probeStreamError: Error | null
let clients: FakeSshClient[]

class FakeSshClient extends EventEmitter {
  connectOptions: Record<string, unknown> | null = null
  launchChannel = new FakeChannel()
  end = vi.fn()
  exec = vi.fn((command: string, optionsOrCallback: unknown, maybeCallback?: (err: unknown, stream?: FakeChannel) => void) => {
    const callback = (typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback) as (err: unknown, stream?: FakeChannel) => void
    if (typeof optionsOrCallback !== 'function') {
      if (launchError) callback(launchError)
      else callback(null, this.launchChannel)
      return
    }

    const channel = new FakeChannel()
    callback(null, channel)
    queueMicrotask(() => {
      if (probeStreamError && command.startsWith('uname -s')) {
        channel.emit('error', probeStreamError)
        return
      }
      const stdout = command.startsWith('uname -s')
        ? 'Linux\nx86_64\nglibc 2.37\n'
        : command === 'echo $HOME'
          ? '/home/tester\n'
          : command.includes('/.ok')
            ? '3.0.0\n'
            : ''
      if (stdout) channel.emit('data', Buffer.from(stdout))
      channel.emit('close', 0)
    })
  })

  connect(options: Record<string, unknown>): void {
    this.connectOptions = options
    if (connectMode === 'authentication-error') {
      queueMicrotask(() => this.emit('error', new Error('All configured authentication methods failed')))
      return
    }
    const verifier = options.hostVerifier as (key: string, callback: (valid: boolean) => void) => void
    verifier('aabbcc', (valid) => {
      queueMicrotask(() => {
        if (valid) this.emit('ready')
        else this.emit('error', new Error('Host denied by verifier'))
      })
    })
  }
}

function makeTransport(verifyHostKey = vi.fn().mockResolvedValue(undefined)): SshTransport {
  return new SshTransport({
    host: 'server.example',
    user: 'alice',
    root: "/srv/O'Reilly project",
    id: 'runtime-ssh',
    privateKey: 'private-key',
    passphrase: 'secret',
    agentSock: '/tmp/agent.sock',
    exclusions: ['node_modules', '.git'],
    idleSuspend: true,
    verifyHostKey,
  })
}

beforeEach(() => {
  connectMode = 'ready'
  launchError = null
  probeStreamError = null
  clients = []
  sshModule.makeClient.mockReset().mockImplementation(() => {
    const client = new FakeSshClient()
    clients.push(client)
    return client
  })
})

describe('SshTransport connection lifecycle', () => {
  it('verifies the host key, forwards connection options, and probes the target', async () => {
    const verifyHostKey = vi.fn().mockResolvedValue(undefined)
    const transport = makeTransport(verifyHostKey)

    await expect(transport.isInstalled('3.0.0')).resolves.toBe(true)

    expect(clients).toHaveLength(1)
    expect(clients[0].connectOptions).toEqual(expect.objectContaining({
      host: 'server.example',
      port: 22,
      username: 'alice',
      privateKey: 'private-key',
      passphrase: 'secret',
      agent: '/tmp/agent.sock',
      keepaliveInterval: 15000,
      readyTimeout: 20000,
      hostHash: 'sha256',
    }))
    expect(verifyHostKey).toHaveBeenCalledWith('aabbcc')
    expect(clients[0].exec).toHaveBeenCalledWith(
      'uname -s; uname -m; (ldd --version 2>&1 | head -n1) || true',
      expect.any(Function),
    )
    expect(clients[0].exec).toHaveBeenCalledWith('echo $HOME', expect.any(Function))
  })

  it('surfaces authentication failures from ssh2', async () => {
    connectMode = 'authentication-error'
    const transport = makeTransport()

    await expect(transport.isInstalled('3.0.0')).rejects.toThrow('All configured authentication methods failed')
  })

  it('surfaces the host-key rejection instead of ssh2 generic verifier failure', async () => {
    const verifyHostKey = vi.fn().mockRejectedValue(new Error('Host key changed'))
    const transport = makeTransport(verifyHostKey)

    await expect(transport.isInstalled('3.0.0')).rejects.toThrow('Host key changed')
    expect(verifyHostKey).toHaveBeenCalledWith('aabbcc')
  })

  it('rejects a channel error during platform probing rather than hanging', async () => {
    probeStreamError = new Error('connection dropped')
    const transport = makeTransport()

    await expect(transport.isInstalled('3.0.0')).rejects.toThrow('connection dropped')
  })

  it('disposes the connection idempotently and reconnects on the next operation', async () => {
    const transport = makeTransport()
    await transport.isInstalled('3.0.0')
    const first = clients[0]

    await transport.dispose()
    await transport.dispose()
    expect(first.end).toHaveBeenCalledTimes(1)

    await transport.isInstalled('3.0.0')
    expect(clients).toHaveLength(2)
  })
})

describe('SshTransport runtime channel', () => {
  it('quotes launch arguments and forwards frames and lifecycle events', async () => {
    const transport = makeTransport()
    await transport.isInstalled('3.0.0')
    const client = clients[0]

    const channel = await transport.launch()

    const launchCall = client.exec.mock.calls.find(([, options]) => typeof options !== 'function')
    expect(launchCall).toBeDefined()
    expect(launchCall?.[0]).toBe(
      "'/home/tester/.cate/runtime/3.0.0/linux-x64/runtime/bin/node' " +
      "'/home/tester/.cate/runtime/3.0.0/linux-x64/runtime.cjs' " +
      "--root '/srv/O'\\''Reilly project' --id 'runtime-ssh' " +
      "--exclude 'node_modules,.git' --idle-suspend",
    )
    expect(launchCall?.[1]).toEqual({ pty: false })

    channel.write('{"id":1}\n')
    expect(client.launchChannel.write).toHaveBeenCalledWith('{"id":1}\n')

    const data = vi.fn()
    const stderr = vi.fn()
    const close = vi.fn()
    channel.onData(data)
    channel.onStderr?.(stderr)
    channel.onClose(close)
    client.launchChannel.emit('data', Buffer.from('response\n'))
    client.launchChannel.stderr.emit('data', Buffer.from('diagnostic'))
    client.launchChannel.emit('close', 9)
    expect(data.mock.calls[0][0].toString()).toBe('response\n')
    expect(stderr.mock.calls[0][0].toString()).toBe('diagnostic')
    expect(close).toHaveBeenCalledWith({ code: 9 })

    channel.kill()
    expect(client.launchChannel.close).toHaveBeenCalledTimes(1)
  })

  it('rejects launch when SSH command forwarding fails', async () => {
    const transport = makeTransport()
    await transport.isInstalled('3.0.0')
    launchError = new Error('administratively prohibited')

    await expect(transport.launch()).rejects.toThrow('administratively prohibited')
  })
})
