import { execFileSync, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { prepareBackport } from '../release/backport-patch'
import { composeReleaseBody } from '../release/compose-release-body'
import { getExpectedReleaseArtifacts } from '../release/edition'
import {
  extractHotfixReleaseNote,
  readBuilderReleaseNotes,
  updateHotfixReleaseMetadata
} from '../release/hotfix-release-notes'
import { syncReleaseHistory } from '../release/sync-release-history'
import { validatePreparedRelease } from '../release/validate-prepared-release'
import {
  validateBuildCompletion,
  validateBuildStart,
  validatePreparationState,
  validatePublishState
} from '../release/validate-release-state'

interface GitFixture {
  patchFile: string
  repo: string
  root: string
}

let roots: string[] = []
let isolatedGitConfigDir: string | undefined
const inheritedGitEnvironment = Object.entries(process.env).filter(
  (entry): entry is [string, string] => entry[0].startsWith('GIT_') && entry[1] !== undefined
)

function clearGitEnvironment(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key]
  }
}

beforeAll(() => {
  clearGitEnvironment()
  // Isolate from the developer's global git config with an empty file instead of
  // os.devNull: on Windows os.devNull is the device path '\\.\nul', which
  // Git for Windows cannot stat ("fatal: unable to access '\\.\nul'"), breaking
  // every git invocation in this file. An empty real file behaves identically
  // (no config entries) on every platform.
  isolatedGitConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-workflow-gitconfig-'))
  fs.writeFileSync(path.join(isolatedGitConfigDir, 'gitconfig'), '')
  process.env.GIT_CONFIG_GLOBAL = path.join(isolatedGitConfigDir, 'gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
})

afterAll(() => {
  clearGitEnvironment()
  for (const [key, value] of inheritedGitEnvironment) process.env[key] = value
  if (isolatedGitConfigDir) fs.rmSync(isolatedGitConfigDir, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function write(cwd: string, filePath: string, contents: string): void {
  const absolutePath = path.join(cwd, filePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, contents)
}

function commit(cwd: string, message: string): string {
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', message)
  return git(cwd, 'rev-parse', 'HEAD')
}

function createGitFixture(baseContents = 'base\n'): GitFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-workflow-'))
  const repo = path.join(root, 'repo')
  fs.mkdirSync(repo)
  roots.push(root)
  git(repo, 'init', '-b', 'main')
  git(repo, 'config', 'user.name', 'Release Test')
  git(repo, 'config', 'user.email', 'release-test@example.com')
  write(repo, 'app.txt', baseContents)
  commit(repo, 'base')
  return { patchFile: path.join(root, 'hotfix.patch'), repo, root }
}

function markOriginMain(repo: string, sha: string): void {
  git(repo, 'update-ref', 'refs/remotes/origin/main', sha)
}

function runBackport(
  fixture: GitFixture,
  mergeSha: string,
  prCommitCount: number,
  associated: Set<string> = new Set()
) {
  return prepareBackport({
    cwd: fixture.repo,
    mergeSha,
    prCommitCount,
    prNumber: 42,
    patchFile: fixture.patchFile,
    getAssociatedPullRequests: (sha: string) => (associated.has(sha) ? [42] : [])
  })
}

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  roots = []
})

describe('backport patch preparation', () => {
  it('applies the complete squash result without backporting unrelated main changes', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    git(fixture.repo, 'checkout', '-b', 'feature')
    write(fixture.repo, 'app.txt', 'first\n')
    commit(fixture.repo, 'first fix')
    write(fixture.repo, 'second.txt', 'second\n')
    commit(fixture.repo, 'second fix')
    git(fixture.repo, 'checkout', 'main')
    write(fixture.repo, 'main-only.txt', 'not part of the fix\n')
    const mainOnlySha = commit(fixture.repo, 'unrelated main work')
    git(fixture.repo, 'merge', '--squash', 'feature')
    const mergeSha = commit(fixture.repo, 'squashed hotfix')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(runBackport(fixture, mergeSha, 2)).toMatchObject({ hasChanges: true, patchBase: mainOnlySha })
    expect(fs.readFileSync(path.join(fixture.repo, 'app.txt'), 'utf8')).toBe('first\n')
    expect(fs.readFileSync(path.join(fixture.repo, 'second.txt'), 'utf8')).toBe('second\n')
    expect(fs.existsSync(path.join(fixture.repo, 'main-only.txt'))).toBe(false)
  })

  it('uses a merge commit first parent so main-only work is not backported', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    git(fixture.repo, 'checkout', '-b', 'feature')
    write(fixture.repo, 'app.txt', 'hotfix\n')
    commit(fixture.repo, 'hotfix')
    git(fixture.repo, 'checkout', 'main')
    write(fixture.repo, 'main-only.txt', 'not part of the fix\n')
    const firstParent = commit(fixture.repo, 'main work')
    git(fixture.repo, 'merge', '--no-ff', 'feature', '-m', 'merge hotfix')
    const mergeSha = git(fixture.repo, 'rev-parse', 'HEAD')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(runBackport(fixture, mergeSha, 1)).toMatchObject({ hasChanges: true, patchBase: firstParent })
    expect(fs.readFileSync(path.join(fixture.repo, 'app.txt'), 'utf8')).toBe('hotfix\n')
    expect(fs.existsSync(path.join(fixture.repo, 'main-only.txt'))).toBe(false)
  })

  it('walks all associated commits from a rebase merge', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    write(fixture.repo, 'app.txt', 'first\n')
    const firstCommit = commit(fixture.repo, 'first rebased fix')
    write(fixture.repo, 'second.txt', 'second\n')
    const mergeSha = commit(fixture.repo, 'second rebased fix')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(runBackport(fixture, mergeSha, 2, new Set([firstCommit]))).toMatchObject({
      hasChanges: true,
      patchBase: base
    })
    expect(fs.readFileSync(path.join(fixture.repo, 'app.txt'), 'utf8')).toBe('first\n')
    expect(fs.readFileSync(path.join(fixture.repo, 'second.txt'), 'utf8')).toBe('second\n')
  })

  it('rejects a partial rebase range when an intermediate commit is not associated with the source PR', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    write(fixture.repo, 'first.txt', 'first\n')
    commit(fixture.repo, 'first rebased fix')
    write(fixture.repo, 'second.txt', 'second\n')
    const secondCommit = commit(fixture.repo, 'second rebased fix')
    write(fixture.repo, 'third.txt', 'third\n')
    const mergeSha = commit(fixture.repo, 'third rebased fix')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(() => runBackport(fixture, mergeSha, 3, new Set([secondCommit]))).toThrow(
      'Cannot identify the complete 3-commit rebase result'
    )
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })

  it('reports a patch already present without staging a duplicate', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    write(fixture.repo, 'app.txt', 'hotfix\n')
    const mergeSha = commit(fixture.repo, 'hotfix')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', mergeSha)

    expect(runBackport(fixture, mergeSha, 1)).toMatchObject({ hasChanges: false, patchBase: base })
    expect(git(fixture.repo, 'diff', '--cached', '--name-only')).toBe('')
    expect(git(fixture.repo, 'diff', '--name-only')).toBe('')
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })

  it('resets a conflicted three-way application to the release head', () => {
    const fixture = createGitFixture('setting=base\n')
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    write(fixture.repo, 'app.txt', 'setting=hotfix\n')
    const mergeSha = commit(fixture.repo, 'hotfix')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)
    write(fixture.repo, 'app.txt', 'setting=release\n')
    commit(fixture.repo, 'release change')

    expect(() => runBackport(fixture, mergeSha, 1)).toThrow(
      /conflicts with the active release branch[\s\S]*Unmerged paths:\napp\.txt/
    )
    expect(fs.readFileSync(path.join(fixture.repo, 'app.txt'), 'utf8')).toBe('setting=release\n')
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })

  it('rejects a symbolic link before release metadata can be updated', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    // Stage the symlink at the index level instead of fs.symlinkSync: creating a
    // real symlink on Windows requires developer mode, and Git for Windows only
    // records mode 120000 when core.symlinks was enabled at init time.
    const linkBlob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: fixture.repo,
      encoding: 'utf8',
      input: 'app.txt'
    }).trim()
    git(fixture.repo, 'update-index', '--add', '--cacheinfo', `120000,${linkBlob},linked.txt`)
    // No 'git add .' here: it would stage the missing worktree file as a deletion
    // and drop the cacheinfo entry before it reaches the tree.
    git(fixture.repo, 'commit', '-m', 'add linked file')
    const mergeSha = git(fixture.repo, 'rev-parse', 'HEAD')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(() => runBackport(fixture, mergeSha, 1)).toThrow('Cannot backport a symbolic link or gitlink')
    expect(fs.existsSync(path.join(fixture.repo, 'linked.txt'))).toBe(false)
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })

  it('rejects an executable mode before release metadata can be updated', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    write(fixture.repo, 'script.sh', '#!/bin/sh\n')
    // fs.chmodSync alone cannot set the exec bit on Windows; flip it in the
    // index (the tree is what prepareBackport inspects) so the mode 100755
    // entry exists on every platform.
    fs.chmodSync(path.join(fixture.repo, 'script.sh'), 0o755)
    git(fixture.repo, 'add', 'script.sh')
    git(fixture.repo, 'update-index', '--chmod=+x', 'script.sh')
    git(fixture.repo, 'commit', '-m', 'add executable')
    const mergeSha = git(fixture.repo, 'rev-parse', 'HEAD')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(() => runBackport(fixture, mergeSha, 1)).toThrow('Cannot backport a file mode change')
    expect(fs.existsSync(path.join(fixture.repo, 'script.sh'))).toBe(false)
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })

  it('rejects a gitlink before release metadata can be updated', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    git(fixture.repo, 'update-index', '--add', '--cacheinfo', `160000,${base},vendor`)
    git(fixture.repo, 'commit', '-m', 'add gitlink')
    const mergeSha = git(fixture.repo, 'rev-parse', 'HEAD')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(() => runBackport(fixture, mergeSha, 1)).toThrow('Cannot backport a symbolic link or gitlink')
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })

  it('rejects an existing-file mode change before release metadata can be updated', () => {
    const fixture = createGitFixture()
    const base = git(fixture.repo, 'rev-parse', 'HEAD')
    git(fixture.repo, 'config', 'core.filemode', 'true')
    fs.chmodSync(path.join(fixture.repo, 'app.txt'), 0o755)
    git(fixture.repo, 'update-index', '--chmod=+x', 'app.txt')
    git(fixture.repo, 'commit', '-m', 'make app executable')
    const mergeSha = git(fixture.repo, 'rev-parse', 'HEAD')
    // The exec bit now lives in the committed tree, which is what prepareBackport
    // diffs. Relax core.filemode so the Windows worktree (fs.chmodSync is a no-op
    // there) does not look dirty and block the checkout below.
    git(fixture.repo, 'config', 'core.filemode', 'false')
    markOriginMain(fixture.repo, mergeSha)
    git(fixture.repo, 'checkout', '-b', 'release', base)

    expect(() => runBackport(fixture, mergeSha, 1)).toThrow('Cannot backport a file mode change')
    expect(git(fixture.repo, 'status', '--porcelain')).toBe('')
  })
})

function hotfixBody(english: string, chinese: string): string {
  return `\`\`\`release-note
<!--LANG:en-->
${english}
<!--LANG:zh-CN-->
${chinese}
<!--LANG:END-->
\`\`\``
}

const HOTFIX_BODY = hotfixBody('[Chat] Fix messages disappearing after restart.', '[聊天] 修复重启后消息消失的问题。')

function releaseNotes(version: string, item: string): string {
  return `<!--LANG:en-->
SuperAgent ${version} - Test Release

🐛 Bug Fixes
- [Chat] ${item}

<!--LANG:zh-CN-->
SuperAgent ${version} - 测试版本

🐛 问题修复
- [聊天] ${item}
<!--LANG:END-->`
}

function builderYaml(notes: string, extra = ''): string {
  const indented = notes
    .split('\n')
    .map((line) => (line ? `    ${line}` : ''))
    .join('\n')
  return `appId: example.app\n${extra}releaseInfo:\n  releaseNotes: |\n${indented}\n`
}

describe('hotfix release notes', () => {
  it('accepts an optional bilingual note for an automatically backported hotfix', () => {
    expect(extractHotfixReleaseNote(HOTFIX_BODY)).toEqual({
      english: '[Chat] Fix messages disappearing after restart.',
      chinese: '[聊天] 修复重启后消息消失的问题。'
    })
    expect(extractHotfixReleaseNote('```release-note\nNONE\n```')).toBeNull()
    expect(extractHotfixReleaseNote('No release note for this internal fix.')).toBeNull()
    expect(() => extractHotfixReleaseNote(`${HOTFIX_BODY}\n\n${HOTFIX_BODY}`)).toThrow('at most one release-note block')
  })

  it('requires Chinese content in a provided Chinese description', () => {
    expect(() => extractHotfixReleaseNote(hotfixBody('[Chat] Fix the issue.', '[Chat] Fix the issue.'))).toThrow(
      'must contain Chinese content'
    )
  })

  it.each([
    HOTFIX_BODY.replace('<!--LANG:en-->', 'Unexpected preface\n<!--LANG:en-->'),
    HOTFIX_BODY.replace('<!--LANG:END-->', '<!--LANG:END-->\nUnexpected suffix')
  ])('rejects text outside the hotfix language-marker span', (body) => {
    expect(() => extractHotfixReleaseNote(body)).toThrow('exact English and Chinese language markers')
  })

  it.each([
    ['a missing component', 'Fix messages disappearing after restart.', '[聊天] 修复重启后消息消失的问题。'],
    [
      'multiple English lines',
      '[Chat] Fix messages disappearing after restart.\n[Chat] Fix another issue.',
      '[聊天] 修复重启后消息消失的问题。'
    ],
    ['a Markdown bullet prefix', '- [Chat] Fix messages disappearing.', '[聊天] 修复消息消失的问题。'],
    ['an empty component', '[] Fix messages disappearing.', '[聊天] 修复消息消失的问题。'],
    ['a missing Chinese component', '[Chat] Fix messages disappearing.', '修复消息消失的问题。'],
    [
      'multiple Chinese lines',
      '[Chat] Fix messages disappearing.',
      '[聊天] 修复消息消失的问题。\n[聊天] 修复另一个问题。'
    ],
    ['a Chinese Markdown bullet prefix', '[Chat] Fix messages disappearing.', '- [聊天] 修复消息消失的问题。'],
    ['an empty Chinese component', '[Chat] Fix messages disappearing.', '[] 修复消息消失的问题。']
  ])('rejects hotfix notes with %s', (_case, english, chinese) => {
    expect(() => extractHotfixReleaseNote(hotfixBody(english, chinese))).toThrow('one [Component] release-note line')
  })

  it('adds the hotfix to installer notes and stable release history exactly once', () => {
    const fixture = createGitFixture()
    const notes = releaseNotes('1.0.0', 'Existing fix.')
    const builderPath = path.join(fixture.repo, 'electron-builder.yml')
    const historyPath = path.join(fixture.repo, 'release-history.json')
    write(fixture.repo, 'electron-builder.yml', builderYaml(notes))
    write(
      fixture.repo,
      'release-history.json',
      `${JSON.stringify([{ version: '1.0.0', releaseNotes: notes }], null, 2)}\n`
    )

    updateHotfixReleaseMetadata({ builderPath, historyPath, prBody: HOTFIX_BODY, version: '1.0.0' })
    updateHotfixReleaseMetadata({ builderPath, historyPath, prBody: HOTFIX_BODY, version: '1.0.0' })

    const updatedNotes = readBuilderReleaseNotes(fs.readFileSync(builderPath, 'utf8')).releaseNotes
    expect(updatedNotes.match(/Fix messages disappearing/g)).toHaveLength(1)
    expect(updatedNotes.match(/修复重启后消息消失/g)).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(historyPath, 'utf8'))[0].releaseNotes).toBe(updatedNotes)
  })

  it.each(['```release-note\nNONE\n```', 'No release note block.'])(
    'leaves release metadata unchanged when no hotfix note is provided',
    (prBody) => {
      const fixture = createGitFixture()
      const notes = releaseNotes('1.0.0', 'Existing fix.')
      const builderPath = path.join(fixture.repo, 'electron-builder.yml')
      const historyPath = path.join(fixture.repo, 'release-history.json')
      const builder = builderYaml(notes)
      const history = `${JSON.stringify([{ version: '1.0.0', releaseNotes: notes }], null, 2)}\n`
      write(fixture.repo, 'electron-builder.yml', builder)
      write(fixture.repo, 'release-history.json', history)

      expect(updateHotfixReleaseMetadata({ builderPath, historyPath, prBody, version: '1.0.0' })).toBeNull()
      expect(fs.readFileSync(builderPath, 'utf8')).toBe(builder)
      expect(fs.readFileSync(historyPath, 'utf8')).toBe(history)
    }
  )

  it('inserts a missing bug-fix category before later release-note categories', () => {
    const fixture = createGitFixture()
    const notes = releaseNotes('1.0.0', 'Existing fix.')
      .replace('🐛 Bug Fixes\n- [Chat] Existing fix.', '💄 Improvements\n- [Chat] Existing improvement.')
      .replace('🐛 问题修复\n- [聊天] Existing fix.', '💄 改进\n- [聊天] 现有改进。')
    const builderPath = path.join(fixture.repo, 'electron-builder.yml')
    const historyPath = path.join(fixture.repo, 'release-history.json')
    write(fixture.repo, 'electron-builder.yml', builderYaml(notes))
    write(
      fixture.repo,
      'release-history.json',
      `${JSON.stringify([{ version: '1.0.0', releaseNotes: notes }], null, 2)}\n`
    )

    updateHotfixReleaseMetadata({ builderPath, historyPath, prBody: HOTFIX_BODY, version: '1.0.0' })

    const updatedNotes = readBuilderReleaseNotes(fs.readFileSync(builderPath, 'utf8')).releaseNotes
    expect(updatedNotes.indexOf('🐛 Bug Fixes')).toBeLessThan(updatedNotes.indexOf('💄 Improvements'))
    expect(updatedNotes.indexOf('🐛 问题修复')).toBeLessThan(updatedNotes.indexOf('💄 改进'))
  })
})

function createPreparedReleaseFixture(targetVersion = '1.1.0', baseVersion = '1.0.0'): GitFixture {
  const fixture = createGitFixture()
  const oldNotes = releaseNotes(baseVersion, 'Old fix.')
  write(fixture.repo, 'package.json', `${JSON.stringify({ name: 'release-test', version: baseVersion }, null, 2)}\n`)
  write(fixture.repo, 'electron-builder.yml', builderYaml(oldNotes))
  write(
    fixture.repo,
    'resources/superagent/release-history.json',
    `${JSON.stringify([{ version: baseVersion, releaseNotes: oldNotes }], null, 2)}\n`
  )
  commit(fixture.repo, 'release metadata baseline')

  const newNotes = releaseNotes(targetVersion, 'New fix.')
  write(fixture.repo, 'package.json', `${JSON.stringify({ name: 'release-test', version: targetVersion }, null, 2)}\n`)
  write(fixture.repo, 'electron-builder.yml', builderYaml(newNotes))
  if (!targetVersion.includes('-')) {
    write(
      fixture.repo,
      'resources/superagent/release-history.json',
      `${JSON.stringify(
        [
          { version: targetVersion, releaseNotes: newNotes },
          { version: baseVersion, releaseNotes: oldNotes }
        ],
        null,
        2
      )}\n`
    )
  }
  return fixture
}

describe('release history synchronization', () => {
  function syncFixture(targetVersion: string): GitFixture {
    const fixture = createPreparedReleaseFixture(targetVersion)
    const historyPath = path.join(fixture.repo, 'resources/superagent/release-history.json')
    git(fixture.repo, 'checkout', '--', 'resources/superagent/release-history.json')
    syncReleaseHistory({
      builderPath: path.join(fixture.repo, 'electron-builder.yml'),
      historyPath,
      version: targetVersion
    })
    return fixture
  }

  it('derives a stable history entry that satisfies the byte-exact validator', () => {
    const fixture = syncFixture('1.1.0')
    expect(() => validatePreparedRelease({ cwd: fixture.repo, targetVersion: '1.1.0' })).not.toThrow()
    const history = JSON.parse(
      fs.readFileSync(path.join(fixture.repo, 'resources/superagent/release-history.json'), 'utf8')
    )
    expect(history.map((entry: { version: string }) => entry.version)).toEqual(['1.1.0', '1.0.0'])
  })

  it('replaces an existing entry for the same version instead of duplicating it', () => {
    const fixture = syncFixture('1.1.0')
    const historyPath = path.join(fixture.repo, 'resources/superagent/release-history.json')
    const before = fs.readFileSync(historyPath, 'utf8')
    syncReleaseHistory({ builderPath: path.join(fixture.repo, 'electron-builder.yml'), historyPath, version: '1.1.0' })
    expect(fs.readFileSync(historyPath, 'utf8')).toBe(before)
  })

  it('leaves release history untouched for a prerelease', () => {
    const fixture = syncFixture('1.1.0-rc.1')
    expect(() => validatePreparedRelease({ cwd: fixture.repo, targetVersion: '1.1.0-rc.1' })).not.toThrow()
  })
})

describe('prepared release validation', () => {
  it('accepts only a version bump, bilingual notes, and the matching stable history entry', () => {
    const fixture = createPreparedReleaseFixture()
    expect(() => validatePreparedRelease({ cwd: fixture.repo, targetVersion: '1.1.0' })).not.toThrow()
  })

  it('rejects unrelated package and electron-builder changes inside the allowed paths', () => {
    const fixture = createPreparedReleaseFixture()
    const manifest = JSON.parse(fs.readFileSync(path.join(fixture.repo, 'package.json'), 'utf8'))
    manifest.name = 'altered'
    write(fixture.repo, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`)
    expect(() => validatePreparedRelease({ cwd: fixture.repo, targetVersion: '1.1.0' })).toThrow(
      'package.json may change only the version field'
    )

    const secondFixture = createPreparedReleaseFixture()
    const builderPath = path.join(secondFixture.repo, 'electron-builder.yml')
    fs.writeFileSync(
      builderPath,
      fs.readFileSync(builderPath, 'utf8').replace('appId: example.app', 'appId: changed.app')
    )
    expect(() => validatePreparedRelease({ cwd: secondFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'electron-builder.yml may change only releaseInfo.releaseNotes'
    )
  })

  it('rejects invalid, non-incrementing, and mismatched package versions', () => {
    const invalidFixture = createPreparedReleaseFixture()
    expect(() => validatePreparedRelease({ cwd: invalidFixture.repo, targetVersion: 'invalid' })).toThrow(
      'Invalid target version'
    )

    const downgradeFixture = createPreparedReleaseFixture()
    expect(() => validatePreparedRelease({ cwd: downgradeFixture.repo, targetVersion: '1.0.0' })).toThrow(
      'must be greater than 1.0.0'
    )

    const mismatchFixture = createPreparedReleaseFixture()
    const packagePath = path.join(mismatchFixture.repo, 'package.json')
    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    manifest.version = '1.2.0'
    write(mismatchFixture.repo, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`)
    expect(() => validatePreparedRelease({ cwd: mismatchFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'does not match 1.1.0'
    )
  })

  it('uses semantic rather than lexical version ordering', () => {
    const upgradeFixture = createPreparedReleaseFixture('1.10.0', '1.9.0')
    expect(() => validatePreparedRelease({ cwd: upgradeFixture.repo, targetVersion: '1.10.0' })).not.toThrow()

    const downgradeFixture = createPreparedReleaseFixture('1.9.0', '1.10.0')
    expect(() => validatePreparedRelease({ cwd: downgradeFixture.repo, targetVersion: '1.9.0' })).toThrow(
      'must be greater than 1.10.0'
    )
  })

  it('rejects missing or duplicate language markers', () => {
    const missingMarkerFixture = createPreparedReleaseFixture()
    const missingMarkerBuilder = path.join(missingMarkerFixture.repo, 'electron-builder.yml')
    fs.writeFileSync(
      missingMarkerBuilder,
      fs.readFileSync(missingMarkerBuilder, 'utf8').replace('<!--LANG:zh-CN-->', '<!--LANG:missing-->')
    )
    expect(() => validatePreparedRelease({ cwd: missingMarkerFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'one ordered set of bilingual markers'
    )

    const duplicateMarkerFixture = createPreparedReleaseFixture()
    const duplicateMarkerBuilder = path.join(duplicateMarkerFixture.repo, 'electron-builder.yml')
    fs.writeFileSync(
      duplicateMarkerBuilder,
      fs
        .readFileSync(duplicateMarkerBuilder, 'utf8')
        .replace('<!--LANG:zh-CN-->', '<!--LANG:en-->\n    <!--LANG:zh-CN-->')
    )
    expect(() => validatePreparedRelease({ cwd: duplicateMarkerFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'one ordered set of bilingual markers'
    )
  })

  it('accepts release-note presentation variations while requiring both language sections', () => {
    const flexibleFixture = createPreparedReleaseFixture()
    const flexibleNotes = `Release announcement\n${releaseNotes('1.0.0', 'New fix.')}\nRead more on the website.`
    write(flexibleFixture.repo, 'electron-builder.yml', builderYaml(flexibleNotes))
    const historyPath = path.join(flexibleFixture.repo, 'resources/superagent/release-history.json')
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'))
    history[0].releaseNotes = flexibleNotes
    write(flexibleFixture.repo, 'resources/superagent/release-history.json', `${JSON.stringify(history, null, 2)}\n`)

    expect(() => validatePreparedRelease({ cwd: flexibleFixture.repo, targetVersion: '1.1.0' })).not.toThrow()

    const emptySectionFixture = createPreparedReleaseFixture()
    write(
      emptySectionFixture.repo,
      'electron-builder.yml',
      builderYaml('<!--LANG:en-->\n\n<!--LANG:zh-CN-->\n中文说明\n<!--LANG:END-->')
    )
    expect(() => validatePreparedRelease({ cwd: emptySectionFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'non-empty English and Chinese sections'
    )
  })

  it('rejects mismatched or discarded stable release history', () => {
    const mismatchedNotesFixture = createPreparedReleaseFixture()
    const mismatchedHistoryPath = path.join(mismatchedNotesFixture.repo, 'resources/superagent/release-history.json')
    const mismatchedHistory = JSON.parse(fs.readFileSync(mismatchedHistoryPath, 'utf8'))
    mismatchedHistory[0].releaseNotes = 'different notes'
    fs.writeFileSync(mismatchedHistoryPath, `${JSON.stringify(mismatchedHistory, null, 2)}\n`)
    expect(() => validatePreparedRelease({ cwd: mismatchedNotesFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'must exactly match electron-builder.yml'
    )

    const discardedHistoryFixture = createPreparedReleaseFixture()
    const discardedHistoryPath = path.join(discardedHistoryFixture.repo, 'resources/superagent/release-history.json')
    const discardedHistory = JSON.parse(fs.readFileSync(discardedHistoryPath, 'utf8'))
    fs.writeFileSync(discardedHistoryPath, `${JSON.stringify([discardedHistory[0]], null, 2)}\n`)
    expect(() => validatePreparedRelease({ cwd: discardedHistoryFixture.repo, targetVersion: '1.1.0' })).toThrow(
      'must preserve existing release history entries'
    )
  })

  it('rejects release-history changes for prereleases', () => {
    const fixture = createPreparedReleaseFixture('1.1.0-rc.1')
    const historyPath = path.join(fixture.repo, 'resources/superagent/release-history.json')
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'))
    history.unshift({ version: '1.1.0-rc.1', releaseNotes: 'unexpected' })
    write(fixture.repo, 'resources/superagent/release-history.json', `${JSON.stringify(history, null, 2)}\n`)

    expect(() => validatePreparedRelease({ cwd: fixture.repo, targetVersion: '1.1.0-rc.1' })).toThrow(
      'unexpected set of source files'
    )
  })

  it('accepts prerelease preparation when release history stays unchanged', () => {
    const fixture = createPreparedReleaseFixture('1.1.0-rc.1')
    expect(() => validatePreparedRelease({ cwd: fixture.repo, targetVersion: '1.1.0-rc.1' })).not.toThrow()
  })

  it('revalidates prepared metadata after the trusted product manifest is generated', () => {
    const fixture = createPreparedReleaseFixture()
    write(fixture.repo, 'resources/builtin-agents/cherry-assistant/product-manifest.json', '{"version":"1.1.0"}\n')

    expect(() =>
      validatePreparedRelease({ cwd: fixture.repo, includeGeneratedManifest: true, targetVersion: '1.1.0' })
    ).not.toThrow()
  })
})

describe('release preparation state', () => {
  it('rejects an existing target release without blocking unrelated drafts', () => {
    const unrelatedDraft = { draft: true, tag_name: 'v1.1.0' }

    expect(() => validatePreparationState({ releasePages: [[unrelatedDraft]], tag: 'v1.2.0' })).not.toThrow()
    expect(() =>
      validatePreparationState({ releasePages: [[unrelatedDraft, { draft: true, tag_name: 'v1.2.0' }]], tag: 'v1.2.0' })
    ).toThrow('Release v1.2.0 already exists')
  })

  it('reads the release list from stdin instead of the process environment', () => {
    const validatorPath = path.resolve(import.meta.dirname, '../release/validate-release-state.js')
    const result = spawnSync(process.execPath, [validatorPath, 'prepare'], {
      encoding: 'utf8',
      env: { ...process.env, RELEASE_PAGES_JSON: '', TAG: 'v1.2.0' },
      input: JSON.stringify([[{ draft: true, tag_name: 'v1.1.0' }]])
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })
})

describe('release publication state', () => {
  const workflowSha = 'a'.repeat(40)
  const expectedBuildTitle = `Release build all release/v1.2.0 @ ${workflowSha}`
  const successfulBuild = {
    conclusion: 'success',
    display_title: expectedBuildTitle,
    event: 'workflow_dispatch',
    head_sha: workflowSha,
    status: 'completed'
  }
  const draftRelease = {
    assets: [{ id: 1 }],
    body: 'Release notes',
    draft: true,
    tag_name: 'v1.2.0',
    target_commitish: workflowSha
  }

  it('builds a compact release page with user downloads and generated changes', () => {
    const builderContent = [
      'releaseInfo:',
      '  releaseNotes: |',
      '    <!--LANG:en-->',
      '    English notes',
      '    <!--LANG:zh-CN-->',
      '    中文说明',
      '    <!--LANG:END-->',
      ''
    ].join('\n')

    const body = composeReleaseBody({
      builderContent,
      generatedNotes: "## What's Changed\n- Fix one\n\n## New Contributors\n- @new",
      productName: 'SuperAgent',
      repository: 'DrOlu/SuperAgent',
      tag: 'v1.2.0'
    })

    expect(body).toContain('## Downloads (v1.2.0)')
    expect(body.match(/^\| (Windows|macOS|Linux) \|/gm)).toHaveLength(6)
    expect(body.match(/https:\/\/github\.com\/DrOlu\/SuperAgent\/releases\/download\/v1\.2\.0\//g)).toHaveLength(
      14
    )
    expect(body).toContain(
      '[Installer](https://github.com/DrOlu/SuperAgent/releases/download/v1.2.0/SuperAgent-1.2.0-win-x64-setup.exe)'
    )
    expect(body).toContain(
      '[RPM](https://github.com/DrOlu/SuperAgent/releases/download/v1.2.0/SuperAgent-1.2.0-linux-arm64.rpm)'
    )
    expect(body).not.toMatch(/\.(?:blockmap|ya?ml|json)\)/)
    expect(body).toContain('<summary>Release Notes</summary>\n\nEnglish notes\n\n</details>')
    expect(body).toContain('| Platform | Architecture | Download |\n| --- | --- | --- |')
    expect(body).not.toMatch(/下载|发布说明|简体中文|中文说明|China Edition|SuperAgent-CN-/)
    expect(body.indexOf('| macOS | Apple silicon (arm64) |')).toBeLessThan(body.indexOf('| macOS | Intel (x64) |'))
    expect(body).not.toContain('<!--LANG:')
    expect(body).not.toContain('## Release Notes')
    expect(body.match(/<summary>/g)).toHaveLength(1)
    expect(body).toContain("</details>\n\n## What's Changed")
    expect(body.indexOf('<summary>Release Notes</summary>')).toBeLessThan(body.indexOf("## What's Changed"))
    expect(body).toContain("## What's Changed\n- Fix one\n\n## New Contributors\n- @new\n")

    const bodyWithoutChanges = composeReleaseBody({
      builderContent,
      generatedNotes: '',
      productName: 'SuperAgent',
      repository: 'DrOlu/SuperAgent',
      tag: 'v1.2.0'
    })
    expect(bodyWithoutChanges.trim()).toBe(body.split("\n\n## What's Changed")[0])
    expect(bodyWithoutChanges).not.toContain("## What's Changed")
    expect(bodyWithoutChanges).toContain('<summary>Release Notes</summary>\n\nEnglish notes\n\n</details>')
  })

  it('accepts only an exact-head all-platform build with artifacts and no open release pull request', () => {
    expect(() =>
      validatePublishState({
        branchSha: workflowSha,
        buildRun: successfulBuild,
        expectedBuildTitle,
        openReleasePullRequests: '',
        pendingHotfixes: '',
        release: draftRelease,
        tag: 'v1.2.0',
        tagSha: workflowSha,
        workflowSha
      })
    ).not.toThrow()
  })

  it.each([
    ['a missing release', null, workflowSha, workflowSha, '', '', successfulBuild, 'must exist and still be a draft'],
    [
      'a published release',
      { ...draftRelease, draft: false },
      workflowSha,
      workflowSha,
      '',
      '',
      successfulBuild,
      'must exist and still be a draft'
    ],
    [
      'a mismatched tag',
      draftRelease,
      'b'.repeat(40),
      workflowSha,
      '',
      '',
      successfulBuild,
      'Tag, release branch, and selected workflow commit must be identical'
    ],
    [
      'a mismatched release target',
      { ...draftRelease, target_commitish: 'b'.repeat(40) },
      workflowSha,
      workflowSha,
      '',
      '',
      successfulBuild,
      'does not target'
    ],
    [
      'a mismatched branch',
      draftRelease,
      workflowSha,
      'b'.repeat(40),
      '',
      '',
      successfulBuild,
      'Tag, release branch, and selected workflow commit must be identical'
    ],
    [
      'an open release pull request',
      draftRelease,
      workflowSha,
      workflowSha,
      'https://example.test/pr',
      '',
      successfulBuild,
      'Release branch still has open pull requests'
    ],
    [
      'a pending merged hotfix',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      'https://example.test/hotfix',
      successfulBuild,
      'Merged hotfix pull requests are still waiting for this release'
    ],
    [
      'a missing build',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      '',
      null,
      'No successful all-platform Release build exists'
    ],
    [
      'a wrong build title',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      '',
      { ...successfulBuild, display_title: 'wrong' },
      'No successful all-platform Release build exists'
    ],
    [
      'a stale build',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      '',
      { ...successfulBuild, head_sha: 'b'.repeat(40) },
      'No successful all-platform Release build exists'
    ],
    [
      'a non-dispatch build',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      '',
      { ...successfulBuild, event: 'push' },
      'No successful all-platform Release build exists'
    ],
    [
      'an incomplete build',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      '',
      { ...successfulBuild, status: 'in_progress' },
      'No successful all-platform Release build exists'
    ],
    [
      'a failed build',
      draftRelease,
      workflowSha,
      workflowSha,
      '',
      '',
      { ...successfulBuild, conclusion: 'failure' },
      'No successful all-platform Release build exists'
    ],
    [
      'a draft without artifacts',
      { ...draftRelease, assets: [] },
      workflowSha,
      workflowSha,
      '',
      '',
      successfulBuild,
      'has no artifacts'
    ],
    [
      'a draft without release notes',
      { ...draftRelease, body: '' },
      workflowSha,
      workflowSha,
      '',
      '',
      successfulBuild,
      'has no release notes'
    ]
  ])(
    'rejects publication with %s',
    (_case, release, tagSha, branchSha, openReleasePullRequests, pendingHotfixes, buildRun, expectedError) => {
      expect(() =>
        validatePublishState({
          branchSha,
          buildRun,
          expectedBuildTitle,
          openReleasePullRequests,
          pendingHotfixes,
          release,
          tag: 'v1.2.0',
          tagSha,
          workflowSha
        })
      ).toThrow(expectedError)
    }
  )

  it('allows all-platform draft movement but restricts single-platform retries to the existing tag', () => {
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'all',
        release: null,
        remoteTagSha: '',
        tag: 'v1.2.0',
        workflowSha
      })
    ).not.toThrow()
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'all',
        release: draftRelease,
        remoteTagSha: 'b'.repeat(40),
        tag: 'v1.2.0',
        workflowSha
      })
    ).not.toThrow()
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'mac',
        release: draftRelease,
        remoteTagSha: workflowSha,
        tag: 'v1.2.0',
        workflowSha
      })
    ).not.toThrow()
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'all',
        release: null,
        remoteTagSha: 'b'.repeat(40),
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('exists without a draft release')
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'all',
        release: { ...draftRelease, draft: false },
        remoteTagSha: workflowSha,
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('already published')
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'linux',
        release: draftRelease,
        remoteTagSha: 'b'.repeat(40),
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('requires an existing draft whose tag already points')
    expect(() =>
      validateBuildStart({
        branchSha: workflowSha,
        platform: 'windows',
        release: null,
        remoteTagSha: workflowSha,
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('requires an existing draft whose tag already points')
    expect(() =>
      validateBuildStart({
        branchSha: 'b'.repeat(40),
        platform: 'all',
        release: draftRelease,
        remoteTagSha: workflowSha,
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('Release branch moved away from selected workflow commit')
    expect(() =>
      validateBuildCompletion({
        branchSha: workflowSha,
        release: { draft: false },
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('refusing any post-publication tag mutation')
    expect(() =>
      validateBuildCompletion({
        branchSha: 'b'.repeat(40),
        release: draftRelease,
        tag: 'v1.2.0',
        workflowSha
      })
    ).toThrow('Release branch moved away from selected workflow commit')
  })
})

describe('release workflow gates (current pipeline)', () => {
  const workflowRoot = path.resolve(import.meta.dirname, '../..', '.github/workflows')
  const readWorkflow = (name: string) => parse(fs.readFileSync(path.join(workflowRoot, name), 'utf8'))
  const stepNames = (job: { steps?: Array<{ name?: string }> }) => (job.steps ?? []).map((step) => step.name ?? '')

  it('keeps exactly the three current SuperAgent workflows', () => {
    const files = fs.readdirSync(workflowRoot).filter((file) => file.endsWith('.yml')).sort()
    expect(files).toEqual(['rebrand.yml', 'release.yml', 'sync-and-release.yml'])
  })

  it('publishes installers pulled from the dispatched build run with checksums', () => {
    const workflow = readWorkflow('release.yml')
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual(['build_run_id', 'tag'])
    const steps = stepNames(workflow.jobs.release)
    expect(steps).toContain('Download build artifacts')
    expect(steps).toContain('Flatten installers + checksums')
    expect(steps).toContain('Create GitHub Release')
    const download = workflow.jobs.release.steps.find(
      (step: { name?: string }) => step.name === 'Download build artifacts'
    )
    expect(download.with['run-id']).toBe('${{ inputs.build_run_id }}')
    const flatten = workflow.jobs.release.steps.find(
      (step: { name?: string }) => step.name === 'Flatten installers + checksums'
    )
    expect(flatten.run).toContain('-name "SuperAgent-*.dmg"')
    expect(flatten.run).toContain('-name "latest*.yml"')
    expect(flatten.run).toContain('sha256sum')
    const publish = workflow.jobs.release.steps.find(
      (step: { name?: string }) => step.name === 'Create GitHub Release'
    )
    expect(publish.with.tag_name).toBe('${{ inputs.tag }}')
    expect(publish.with.fail_on_unmatched_files).toBe(true)
    expect(publish.with.make_latest).toBe(true)
  })

  it('syncs upstream, gates on the typecheck, and only releases when upstream moved', () => {
    const workflow = readWorkflow('sync-and-release.yml')
    expect(Object.keys(workflow.on)).toEqual(['schedule', 'workflow_dispatch'])
    expect(workflow.on.workflow_dispatch.inputs.force).toBeDefined()
    expect(workflow.on.workflow_dispatch.inputs.version).toBeDefined()
    const sync = workflow.jobs.sync
    const findStep = (predicate: (step: { name?: string; id?: string }) => boolean) =>
      (sync.steps ?? []).find(predicate) as { outputs?: Record<string, string>; run?: string; env?: Record<string, string> }
    const checkStep = findStep((step) => step.id === 'check' || step.name === 'Check if upstream moved since last sync')
    const bumpStep = findStep((step) => step.id === 'bump')
    const commitStep = findStep((step) => step.id === 'commit')
    const typecheckStep = findStep((step) => step.name === 'Typecheck gate (never push a tree that does not compile)')
    // Step outputs land in the job-level outputs (GitHub Actions contract).
    expect(sync.outputs.do_release).toBe('${{ steps.check.outputs.do_release }}')
    expect(checkStep.run).toContain('do_release=')
    // Bump outputs surface at the job level (GitHub Actions contract).
    expect(sync.outputs.new_version).toBe('${{ steps.bump.outputs.version }}')
    expect(sync.outputs.release_tag).toBe('${{ steps.bump.outputs.tag }}')
    expect(bumpStep.run).toContain('resources/superagent/release-history.json')
    expect(bumpStep.run).toContain('<!--LANG:zh-CN-->')
    expect(typecheckStep.run).toContain('pnpm run typecheck:node')
    expect(sync.steps.find((step: { name?: string }) => step.name === 'Save preserved files').run).toContain(
      'src/main/ai/mcp/servers/neuralos'
    )
    expect(commitStep.env.SUPERAGENT_PAT).toBe('${{ secrets.SUPERAGENT_PAT }}')
  })

  it('builds all three platforms and verifies the bundled neuralOS engine', () => {
    const workflow = readWorkflow('sync-and-release.yml')
    const build = workflow.jobs.build
    expect(build.needs).toBe('sync')
    expect(build.strategy.matrix.include.map((entry: { target: string }) => entry.target)).toEqual([
      'linux',
      'mac',
      'win'
    ])
    const names = stepNames(build)
    expect(names).toContain('Download neuralOS engine + weights')
    expect(names).toContain('Verify bundled neuralOS engine')
    expect(names).toContain('Compile ${{ matrix.target }}')
    const engine = build.steps.find((step: { name?: string }) => step.name === 'Download neuralOS engine + weights')
    expect(engine.run).toContain('resources/neuralos/needle3.cact')
    expect(engine.run).toContain('chmod +x resources/neuralos/engine-*')
    const verify = build.steps.find((step: { name?: string }) => step.name === 'Verify bundled neuralOS engine')
    expect(verify.run).toContain('test -f "$found/needle3.cact"')
    const upload = build.steps.find((step: { name?: string }) => step.name === 'Upload artifacts')
    expect(upload.with.name).toBe('superagent-${{ matrix.target }}-${{ github.run_id }}')
    expect(upload.with['retention-days']).toBe(14)
  })

  it('publishes the release from the sync outputs with checksums', () => {
    const workflow = readWorkflow('sync-and-release.yml')
    const release = workflow.jobs.release
    expect(release.needs).toEqual(['sync', 'build'])
    const publish = release.steps.find((step: { name?: string }) => step.name === 'Create GitHub Release')
    expect(publish.with.tag_name).toBe('${{ needs.sync.outputs.release_tag }}')
    expect(publish.with.fail_on_unmatched_files).toBe(true)
  })

  it('rebrands a fresh Cherry Studio clone and verifies the neuralOS integration', () => {
    const workflow = readWorkflow('rebrand.yml')
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual(['skip_build', 'push_target'])
    const rebrand = workflow.jobs.rebrand
    const names = stepNames(rebrand)
    expect(names).toContain('Clone Cherry Studio')
    expect(names).toContain('Run rebrand script')
    expect(names).toContain('Generate icons from logo')
    expect(names).toContain('Verify key branding')
    expect(names).toContain('Verify neuralOS integration')
    const integration = rebrand.steps.find((step: { name?: string }) => step.name === 'Verify neuralOS integration')
    expect(integration.run).toContain('neuralos: ' + String.fromCharCode(39) + '@cherry/neuralos' + String.fromCharCode(39))
    expect(integration.run).toContain('src/main/ai/mcp/servers/__tests__/neuralos.test.ts')
    const build = workflow.jobs.build
    expect(build.needs).toBe('rebrand')
    expect(build['if']).toContain('skip_build')
    expect(build.strategy.matrix.include.map((entry: { target: string }) => entry.target)).toEqual([
      'linux',
      'mac',
      'win'
    ])
    const push = rebrand.steps.find((step: { id?: string }) => step.id === 'commit')
    expect(push.env.SUPERAGENT_PAT).toBe('${{ secrets.SUPERAGENT_PAT }}')
    expect(push.run).toContain('github.com/DrOlu/SuperAgent')
  })
})
