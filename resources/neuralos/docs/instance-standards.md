# neuralOS instance standards

The generated instance is only as reliable as its menu. These rules come from
the neuralOS skill and are enforced by the generator; carry them into any manual
extension.

## Menu rules

1. **Triggers on every entry**, disjoint between entries. Generated pattern:
   `<table>_count` → ["how many <t>", "count <t>", ...]; shared verbs like
   "how many" are fine only when the object noun disambiguates.
2. **Arguments constrained in the grammar**: enum columns become `enum`
   properties (the decode grammar then cannot emit an unobserved value),
   limits get `minimum/maximum`, identifiers get `pattern`s.
3. **Results small**: probes return at most ROW_CAP (25) rows plus counts; the
   full truth stays in the source. Aggregate probes return numbers only.
4. **Secrets baked in the bridge only**: DSNs/API keys are constants or env
   lookups in bridge.py. Never a model-facing argument — grounding refuses
   them anyway, and executors are the right home.
5. **Read-only first**: write/update probes are added only after the user
   approves, behind an explicit flag, and always with identity checks.
6. **Errors are data**: a failed retrieval returns {"error": …} to the model,
   which may retry within the step bound.

## Bridge rules

- Every record passes through the Pydantic model before it reaches a probe's
  return value; parse failures are counted into `_VALIDATION` and surfaced by
  `instance.py --coverage` / `verify.py`.
- Identifiers (table/column names) are whitelisted against the profile before
  interpolation into SQL — the model may fill arguments, the executor validates.
- Row caps in the bridge, not just in prompts: a "limit 10000" request still
  returns at most ROW_CAP rows plus a total count.

## Runtime rules

- Python runtime: `instance.py` defines the same menu as `@needle.tool`
  functions (triggers included) so the agentic loop can execute probes itself;
  `response["results"]` is the success signal.
- **The decorator does not self-register.** Every probe must be passed to the
  agent — keep a `TOOLS` list and `TOOLS.append(<name>)` immediately after
  each `def`. A probe missing from the list is invisible to the agent: the
  script runs, the probe unit-tests fine, and selection silently fails. This
  wiring trap has fired three times in live builds — check the append before
  debugging anything else.
- **Deterministic agent posture** (verified on the chinook/soc instances):
  fixed `system=` facts + `auto_date=False` (the drifting date fact flips
  121M selection between runs), and `max_steps=1` for self-contained probes
  (default 8 invites a correct call plus a bonus unrelated call).
- **More than ~12 probes → use the tool index**
  (`tool_index_path=".tool_index.json"` / engine `--tool-index`). In-context
  tool sets misroute past that size (observed 0/14 at 25 tools in context;
  14/14 behind an index). After editing triggers or descriptions, discard the
  stale `.tool_index.json` so it rebuilds.
- Engine runtime: `needle_menu.json` feeds the standalone binary; the engine
  selects, the bridge executes. Selection is deterministic across runs.

## Verification (Phase 4) contract

1. Coverage: ≥95% of fetched records parse through the models.
2. Selection: three phrasings of one intent all select the same probe.
3. Truth: one relayed number equals a direct source query.
Record all three in `verification.txt` next to the instance.
