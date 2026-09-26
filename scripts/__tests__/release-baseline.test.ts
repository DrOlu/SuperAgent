import { execFileSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { parse } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '../..')
const workflow = parse(fs.readFileSync(path.join(projectRoot, '.github/workflows/sync-and-release.yml'), 'utf8'))
const bumpStep = workflow.jobs.sync.steps.find((step: { id?: string }) => step.id === 'bump')
const roots: string[] = []

interface Fixture {
  repo: string
  git: (...args: string[]) => string
  commit: (message: string) => string
  run: (options?: { versionInput?: string; releaseTags?: string[] }) => {
    status: number | null
    stderr: string
    stdout: string
    output: Record<string, string>
    packageVersion: string
    history: Array<{ version: string; releaseNotes: string }>
  }
}

function createFixture(currentVersion = '2.1.0'): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-baseline-'))
  roots.push(root)
  const repo = path.join(root, 'repo')
  fs.mkdirSync(path.join(repo, 'resources/superagent'), { recursive: true })
  const config = path.join(root, 'gitconfig')
  fs.writeFileSync(config, '')
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_NOSYSTEM: '1',
    NODE_PATH: path.join(projectRoot, 'node_modules'),
    REPO: 'DrOlu/SuperAgent',
    GITHUB_OUTPUT: path.join(root, 'output'),
    RELEASE_FIXTURE: path.join(root, 'releases.json')
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8' }).trim()
  const commit = (message: string) => {
    git('add', '.')
    git('commit', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  git('init', '-b', 'main')
  git('config', 'user.name', 'Release Test')
  git('config', 'user.email', 'release-test@example.com')
  git('remote', 'add', 'origin', repo)
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'superagent', version: currentVersion }))
  fs.writeFileSync(
    path.join(repo, 'resources/superagent/release-history.json'),
    JSON.stringify([
      {
        version: currentVersion,
        releaseNotes:
          '<!--LANG:en-->\nPrevious notes.\n\n<!--LANG:zh-CN-->\nPrevious notes.\n\n<!--LANG:END-->\n'
      }
    ])
  )
  commit('chore(release): seed metadata')

  const run: Fixture['run'] = (options = {}) => {
    // `gh release list -L 1 --json tagName -q '.[0].tagName'` prints bare tags;
    // the mock serves the same shape from a text fixture.
    const releaseTags = options.releaseTags ?? [`v${currentVersion}`]
    fs.writeFileSync(env.RELEASE_FIXTURE, releaseTags.join('\n'))
    fs.writeFileSync(env.GITHUB_OUTPUT, '')
    const renderedScript = bumpStep.run
      .replaceAll('${{ github.event.inputs.version }}', options.versionInput ?? '')
      .replaceAll("${{ secrets.GITHUB_TOKEN }}", 'fixture-token')
    const result = spawnSync(
      'bash',
      [
        '-e',
        '-o',
        'pipefail',
        '-c',
        // The step shells out to `gh release list` for the auto-bump baseline;
        // serve the fixture releases instead of the live API.
        `gh() { cat "$RELEASE_FIXTURE"; }\n${renderedScript}`
      ],
      { cwd: repo, env: { ...env }, encoding: 'utf8' }
    )
    const output = Object.fromEntries(
      fs
        .readFileSync(env.GITHUB_OUTPUT, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('='))
    )
    const packageVersion = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version
    const history = JSON.parse(fs.readFileSync(path.join(repo, 'resources/superagent/release-history.json'), 'utf8'))
    return { ...result, output, packageVersion, history }
  }
  return { repo, git, commit, run }
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

// The bump step targets Ubuntu runners; Windows Bash cannot consume native fixture paths.
describe.skipIf(process.platform === 'win32')('release version bump (sync-and-release bump step)', () => {
  it('auto-bumps the patch from the latest SuperAgent release tag', () => {
    const fixture = createFixture('2.1.0')
    const result = fixture.run({ releaseTags: ['v2.1.0'] })

    expect(result.status, result.stderr).toBe(0)
    expect(result.output.version).toBe('2.1.1')
    expect(result.output.tag).toBe('v2.1.1')
    expect(result.packageVersion).toBe('2.1.1')
  })

  it('honors an explicit version input over the auto-bump', () => {
    const fixture = createFixture('2.1.0')
    const result = fixture.run({ versionInput: '3.0.0' })

    expect(result.status, result.stderr).toBe(0)
    expect(result.output.version).toBe('3.0.0')
    expect(result.output.tag).toBe('v3.0.0')
    expect(result.packageVersion).toBe('3.0.0')
  })

  it('prepends a bilingual release-notes entry and keeps existing history', () => {
    const fixture = createFixture('2.1.0')
    const result = fixture.run({ versionInput: '2.2.0' })

    expect(result.status, result.stderr).toBe(0)
    expect(result.history).toHaveLength(2)
    expect(result.history[0].version).toBe('2.2.0')
    expect(result.history[1].version).toBe('2.1.0')
    const notes = result.history[0].releaseNotes
    expect(notes).toContain('<!--LANG:en-->')
    expect(notes).toContain('<!--LANG:zh-CN-->')
    expect(notes).toContain('<!--LANG:END-->')
    expect(notes).toContain('Hyperspace Technologies')
    expect(notes.endsWith('\n')).toBe(true)
  })

  it('does not duplicate a history entry when the version already exists', () => {
    const fixture = createFixture('2.1.0')
    fixture.run({ versionInput: '2.2.0' })
    const second = fixture.run({ versionInput: '2.2.0' })

    expect(second.status, second.stderr).toBe(0)
    expect(second.history).toHaveLength(2)
    expect(second.history.filter((entry) => entry.version === '2.2.0')).toHaveLength(1)
  })
})
