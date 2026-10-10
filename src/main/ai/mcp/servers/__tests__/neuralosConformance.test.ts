/**
 * Shared refusal-gate conformance (ReactorPro #107).
 *
 * The gate exists as three copies (ReactorPro, SuperAgent, neuralOSd) and their
 * contract had already forked. `resources/neuralos/conformance/refusal_gate.json`
 * is the product-agnostic fixture those products share; ReactorPro and neuralOSd
 * execute it against a generated ask.py in their CI.
 *
 * This test pins the VENDORED generator against that fixture's contract, which
 * is what drifts when the tree is re-synced from upstream:
 *   - GATE_VERSION is the version the fixture was written for;
 *   - refusal_reason stays a BARE TOKEN (never a formatted string);
 *   - the specifics live in `refusal_detail`;
 *   - exit codes are the shared 0 answered / 2 nothing produced;
 *   - every reason the fixture uses is in the generator's vocabulary.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const FIXTURE = path.join(REPO, 'resources', 'neuralos', 'conformance', 'refusal_gate.json')
const GENERATOR = path.join(REPO, 'resources', 'neuralos', 'scripts', 'gen_needle_instance.py')

type Case = { question: string; kind: 'answer' | 'refuse'; probe?: string; reason?: string }
type Fixture = {
  gate_version: number
  contract: {
    exit_codes: { answered: number; refused: number }
    refusal_reasons: string[]
    reasons_are_bare_tokens: boolean
    detail_field: string
  }
  menu: { name: string; triggers: string[] }[]
  cases: Case[]
  false_refusal_sweep: boolean
}

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE, 'utf-8')) as Fixture
}

function generator(): string {
  return readFileSync(GENERATOR, 'utf-8')
}

describe('neuralOS refusal-gate conformance (shared fixture)', () => {
  it('ships the shared fixture with the agreed contract', () => {
    expect(existsSync(FIXTURE)).toBe(true)
    const spec = fixture()
    expect(spec.contract.exit_codes).toEqual({ answered: 0, refused: 2 })
    expect(spec.contract.reasons_are_bare_tokens).toBe(true)
    expect(spec.contract.detail_field).toBe('refusal_detail')
    expect(spec.cases.length).toBeGreaterThanOrEqual(10)
    expect(spec.false_refusal_sweep).toBe(true)
    for (const item of spec.cases) {
      if (item.reason !== undefined) expect(item.reason).not.toContain('(')
    }
  })

  it('the vendored generator stamps the shared gate version and exit codes', () => {
    const src = generator()
    const spec = fixture()
    expect(src).toContain(`GATE_VERSION = ${spec.gate_version}`)
    // 0 answered / 2 nothing produced, the shared mapping.
    expect(src).toMatch(/SystemExit\(2\)|REFUSED_EXIT\s*=\s*2/)
  })

  it('reasons stay bare tokens and carry their detail separately', () => {
    const src = generator()
    // A formatted reason is exactly the fork this issue tracked.
    expect(src).not.toMatch(/refusal_reason["']?\s*[:=]\s*["'][a-z_]+\(/)
    expect(src).not.toContain('no_probe_matches(unknown')
    expect(src).not.toMatch(/low_coverage\(%/)
    // The detail field exists, and is declared even when answering.
    expect(src).toContain('refusal_detail')
  })

  it('the generator knows every reason the fixture uses', () => {
    const src = generator()
    for (const reason of ['action_intent', 'dropped_filter', 'no_probe_matches', 'low_coverage']) {
      expect(src).toContain(reason)
    }
  })

  it('the fixture only asserts reasons it declares', () => {
    const spec = fixture()
    const declared = new Set(spec.contract.refusal_reasons)
    for (const item of spec.cases) {
      if (item.kind === 'refuse') expect(declared.has(item.reason as string)).toBe(true)
    }
  })
})
