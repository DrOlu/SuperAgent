/**
 * Acceptance (e)/(f): the GENERATED ask.py carries the refusal gate.
 * Materialises the ASK_PY template from resources/neuralos/scripts/
 * gen_needle_instance.py into a tmp instance (menu + stub bridge/instance,
 * no needle dependency), runs it with the real interpreter, and asserts the
 * envelope contract: refused/refusal_reason/GATE_VERSION on refusals,
 * legacy keys intact on answers, and pattern-caged args actually bound.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const SCRIPTS = path.join(REPO, 'resources', 'neuralos', 'scripts')
const PY = process.env.NEURALOS_TEST_PYTHON || 'python3'

const tmpDirs: string[] = []
afterAll(() => {
  // leave the tmp dirs for CI artifact pickup; the OS cleans /tmp
})

function materialiseInstance(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'neuralos-gated-'))
  tmpDirs.push(dir)
  // Python must emit ASK_PY itself: the template's escapes (\n, \b, \") are
  // only unescaped by the interpreter — a raw copy is not valid Python.
  const askPyPath = path.join(dir, 'ask.py')
  execFileSync(
    PY,
    [
      '-c',
      `import sys; sys.path.insert(0, ${JSON.stringify(SCRIPTS)}); ` +
        `import gen_needle_instance as g; open(${JSON.stringify(askPyPath)}, 'w').write(g.ASK_PY)`
    ],
    { timeout: 60_000 }
  )
  expect(existsSync(askPyPath)).toBe(true)

  const menu = [
    {
      name: 'count_rows',
      description: 'Count the rows in the dataset.',
      triggers: ['count rows', 'how many rows', 'row count'],
      parameters: {
        type: 'object',
        // an enum VALUE containing the action verb must not teach the menu
        // the verb — capability ≠ data
        properties: { dataset: { type: 'string', enum: ['do-not-delete-archive', 'ledger'] } },
        required: []
      }
    },
    {
      name: 'get_page',
      description: 'Read one page of the report by number.',
      triggers: ['show page', 'page content', 'read page'],
      parameters: {
        type: 'object',
        properties: { n: { type: 'integer', pattern: 'page\\s+(\\d{1,3})', minimum: 1 } },
        required: ['n']
      }
    }
  ]
  writeFileSync(path.join(dir, 'needle_menu.json'), JSON.stringify(menu, null, 1))
  writeFileSync(
    path.join(dir, 'bridge.py'),
    [
      'import json, os',
      'LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge_calls.log")',
      'def _log(name):',
      '    with open(LOG, "a", encoding="utf-8") as fh:',
      '        fh.write(name + chr(10))',
      'def count_rows():',
      '    _log("count_rows")',
      '    return {"rows": 5}',
      'def page_reader(n=1):',
      '    _log("get_page:%s" % n)',
      '    return {"page": n, "text": "page %s text" % n}',
      'def _calls():',
      '    return list(CALLS)'
    ].join('\n')
  )
  writeFileSync(
    path.join(dir, 'instance.py'),
    [
      'import sys, types',
      'fake = types.ModuleType("needle")',
      'class Needle:',
      '    def __init__(self, tools=None, system=None, auto_date=False):',
      '        self.tools = tools or []',
      '    def run(self, q, max_steps=1):',
      '        name = self.tools[0].__name__ if self.tools else "none"',
      '        return {"results": [{"_tool": name, "via": "model"}], "confidence": 0.5}',
      'fake.Needle = Needle',
      'fake.tool = lambda **kw: (lambda f: f)',
      'sys.modules["needle"] = fake',
      'import needle  # binds the module for the ask.py model fallback',
      'import bridge',
      'def count_rows():',
      '    return bridge.count_rows()',
      'def get_page(n=1):',
      '    return bridge.page_reader(int(n))',
      'TOOLS = [count_rows, get_page]'
    ].join('\n')
  )
  writeFileSync(path.join(dir, 'ask.py'), readFileSync(askPyPath, 'utf-8'))
  expect(existsSync(path.join(dir, 'ask.py'))).toBe(true)
  return dir
}

function runAsk(dir: string, question: string): { code: number; envelope: Record<string, unknown> } {
  let stdout = ''
  let code = 0
  try {
    stdout = execFileSync(PY, [path.join(dir, 'ask.py'), question, '--no-cache'], {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 60_000
    })
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    code = e.status ?? 1
    stdout = e.stdout ?? ''
    if (!stdout.trim()) {
      throw new Error(`ask.py produced no stdout (exit ${code}): ${(e.stderr ?? '').slice(0, 400)}`)
    }
  }
  return { code, envelope: JSON.parse(stdout) as Record<string, unknown> }
}

function bridgeCalls(dir: string): string[] {
  const log = path.join(dir, 'bridge_calls.log')
  if (!existsSync(log)) return []
  return readFileSync(log, 'utf-8')
    .split('\n')
    .filter((line) => line.trim() !== '')
}

describe('generated ask.py — refusal gate (GATE_VERSION 1)', () => {
  let dir: string
  it('materialises the template', () => {
    dir = materialiseInstance()
  })

  it('refuses an imperative action without executing any probe', () => {
    const { code, envelope } = runAsk(dir, 'delete all the rows')
    expect(envelope['refused']).toBe(true)
    expect(envelope['refusal_reason']).toBe('action_intent')
    expect(envelope['gate_version']).toBe(1)
    expect(envelope['probe']).toBeNull()
    expect(code).toBe(2)
    expect(bridgeCalls(dir)).toEqual([]) // nothing executed on the refusal path
  })

  it('refuses a dropped qualifier the menu does not carry', () => {
    const { envelope } = runAsk(dir, 'show blocked pages content')
    expect(envelope['refused']).toBe(true)
    expect(envelope['refusal_reason']).toBe('dropped_filter:blocked')
    expect(envelope['gate_version']).toBe(1)
  })

  it('refuses a question whose whole domain is unknown', () => {
    const { envelope } = runAsk(dir, 'frobnicate the widget archive')
    expect(envelope['refused']).toBe(true)
    expect(envelope['refusal_reason']).toBe('no_probe_matches')
  })

  it('binds pattern-caged arguments and answers with the legacy envelope', () => {
    const { code, envelope } = runAsk(dir, 'show page 42 content')
    expect(code).toBe(0)
    // (f) legacy keys unchanged:
    for (const key of ['probe', 'confidence', 'latency_ms', 'mode', 'results']) {
      expect(envelope).toHaveProperty(key)
    }
    // new fields coexist:
    expect(envelope['refused']).toBe(false)
    expect(envelope['refusal_reason']).toBeNull()
    expect(envelope['gate_version']).toBe(1)
    // (5) the pattern cage actually bound n=42:
    expect(bridgeCalls(dir)).toContain('get_page:42')
    expect(JSON.stringify(envelope['results'])).toContain('42')
  })

  it('answers a plain count without refusing', () => {
    const { code, envelope } = runAsk(dir, 'count rows')
    expect(code).toBe(0)
    expect(envelope['refused']).toBe(false)
    expect(envelope['probe']).toBe('count_rows')
  })

  it('sits the gate conformance exam (gate_conformance.py fixture)', () => {
    // The fleet exam: materialises its own gated instance from ASK_PY and
    // asserts the full GATE_VERSION 1 contract black-box. A nonzero exit
    // means the generated Python gate broke the shared contract.
    const runner = path.join(SCRIPTS, 'run_gate_conformance_fixture.py')
    expect(existsSync(runner)).toBe(true)
    execFileSync(PY, [runner], { encoding: 'utf-8', timeout: 120_000 })
  })
})
