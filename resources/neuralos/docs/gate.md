# The refusal gate & the ask envelope (GATE_VERSION 1)

Every ask ends in one of two honest outcomes: a **confident answer**, or a
**refusal**. A confident wrong number is worse than an honest "I cannot
answer this" — the gate is what makes refusals systematic instead of
heroic. It is a pure function of the menu and the question: no probe runs,
no model is called, microseconds.

Three implementations share one observable contract: the generated
`ask.py` gate, SuperAgent's TypeScript gate (`askGate`), and neuralOSd's
`router.py::_gate`. Conformance is enforced black-box by
`scripts/gate_conformance.py` (shipped beside this manual) via
`scripts/run_gate_conformance_fixture.py` in CI.

## The envelope

Every `ask.py` run prints exactly one JSON envelope on stdout:

```json
{
  "ask_id": "a-3f9c", "question": "count rows",
  "probe": "count_rows", "confidence": 0.9, "latency_ms": 12,
  "mode": "retrieval",
  "refused": false, "refusal_reason": null, "gate_version": 1,
  "results": [{"rows": 5}]
}
```

| Exit | Meaning | Envelope |
|---|---|---|
| `0` | answered | `refused: false`, `refusal_reason: null`, legacy keys intact |
| `2` | refused / nothing produced | `refused: true`, named `refusal_reason`, `results: null`, `candidates_retrieved` filled |

Refusals are never empty stdout. `stderr` is human diagnostics only.

## The four refusal reasons (checked in order)

1. **`action_intent`** — the first word is an imperative verb
   (`play erase delete remove drop wipe purge send execute restart
   shutdown kill exploit deploy cancel`) that no probe claims as a
   capability. Never bypassed — not even by a cleanly extracted enum
   argument. Capability words are triggers/names/descriptions only:
   **enum values are data, not capabilities** (a bucket named
   `do-not-delete-…` must not teach the menu the verb).
2. **`no_probe_matches`** — a subject noun unknown to every probe
   (plural-insensitive). Answering from the nearest probe is a guess
   wearing a confidence score.
3. **`dropped_filter:<qualifier>`** — the question names a status/time
   filter (blocked, overdue, last month, …) the winning probe cannot
   apply; executing it would silently drop the filter.
4. **`low_coverage`** — the winner knows under half the question's domain
   nouns; it probably won on filler like "how many".

A visible enum/pattern **cage** hit (the question contains an exact enum
value, or matches the argument pattern) vouches for the winner and
bypasses reasons 2–4 — never reason 1. Pattern/integer cages must
actually bind: `load_cages` registers every required enum, pattern and
integer argument.

The gate outranks the retrieval miss: an empty retrieval still refuses
`action_intent` imperatives rather than reporting a mere "no match".

## Audit & the gap loop

Every ask appends one JSON line to `ask_audit.jsonl` in the instance
directory — answered, refused, or empty — with `refusal_reason` and
`candidates_retrieved` on refusals. Refusals decided inside SuperAgent
are appended by its TS gate in the same shape, marked
`"via": "superagent-ts"`. Mine the log (`mine_gaps.py` in the neuralos
skill) to propose trigger fixes and new probes: a refused question is a
work item, not a dead end.

## What SuperAgent adds around the contract

- **ask.py-preferred answering** — if the instance ships an `ask.py`, its
  envelope is the answer; a refused envelope is terminal (no engine, no
  probe).
- **TS gate before the engine** on instances without ask.py — imperatives
  are refused before anything executes, even when retrieval is empty.
- **Backstop on gateless hand-authored ask.py** — an imperative answer is
  withheld; the caller gets the refusal. Vocabulary rules do not
  second-guess an ask.py that answered (its menu is simply thinner than
  its fast-paths).
- **`confidence_calibrated: false`** on answered tool results — the raw
  pick confidence is uncalibrated; do not treat it as a probability.
