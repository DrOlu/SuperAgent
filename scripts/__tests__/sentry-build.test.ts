import { readFileSync } from 'node:fs'
import path from 'node:path'

const projectRoot = path.join(import.meta.dirname, '..', '..')

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSentryBuildSettings } from '../../electron.vite.config'

describe('Sentry production build', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('fails a production Sentry build when source-map upload credentials are incomplete', () => {
    expect(() =>
      resolveSentryBuildSettings({
        NODE_ENV: 'production',
        SENTRY_SOURCE_MAP_UPLOAD: 'true'
      })
    ).toThrow('Sentry production builds require: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT')
  })

  it('does not require upload credentials for ordinary production builds', () => {
    expect(
      resolveSentryBuildSettings({
        NODE_ENV: 'production'
      })
    ).toEqual({ sourceMapUploadEnabled: false })
  })

  it('keeps source-map upload opt-in in ordinary build commands', () => {
    const { scripts } = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))

    for (const command of ['build', 'build:cn']) {
      expect(scripts[command]).not.toContain('SENTRY_SOURCE_MAP_UPLOAD')
    }
  })

  it('generates hidden source maps for every Electron bundle when upload is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SENTRY_SOURCE_MAP_UPLOAD', 'true')
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'test-token')
    vi.stubEnv('SENTRY_ORG', 'test-org')
    vi.stubEnv('SENTRY_PROJECT', 'test-project')
    vi.resetModules()

    const { default: config } = await import('../../electron.vite.config')
    const builds = config as {
      main: { build: { sourcemap: unknown } }
      preload: { build: { sourcemap: unknown } }
      renderer: { build: { sourcemap: unknown } }
    }

    expect(builds.main.build.sourcemap).toBe('hidden')
    expect(builds.preload.build.sourcemap).toBe('hidden')
    expect(builds.renderer.build.sourcemap).toBe('hidden')
  })

})
