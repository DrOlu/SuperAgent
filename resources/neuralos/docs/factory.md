# neuralOS Data — profile any source, generate its neuralOS instance

This manual converts **any data source** into three deliverables, generated
from what the data actually contains:

1. a **strict Pydantic model** (`models.py`) that captures every attribute the
   data exposes — typed, constrained, nullable where the data is nullable;
2. a **neuralOS instance** (`needle_menu.json` + bridge + agent) that parses and
   queries that data in real time through on-device tool calling;
3. a **relationship layer** (`graph_edges.json` + ≤3 graph probes) that makes
   cross-entity joins first-class, with provenance on every edge and honest
   reporting when joins are impossible.

Nothing is assumed from file names or guesses: every field, type, range,
pattern and enum value comes from **profiling the data first**.

(The on-device CLI/runtime keeps the historical `needle` name — the `needle`
binary, the `needle` python package, `needle_menu.json` and `@needle.tool`
are code-level identifiers and stay as they are. All prose and docs say
**neuralOS**. The CLI answers to `needle` or `neural` and the weights to
`needle3.cact` or `neuralOS.engine` — same runtime, both spellings, every
platform.)

## Where the tooling lives

The generator scripts ship with the app, beside this manual:
`neuralos_docs(topic: "index")` prints the exact `scripts` directory for this
install (typically `<resources>/neuralos/scripts/`). Run them with the same
Python the instances will use. They are standard-library-only (plus
`usql`/`sqlite3` for databases; openpyxl/pandas opportunistically for
XLSX/parquet), so any Python 3.9+ works.

## The four-phase workflow

```
PROFILE ──► MODEL ──► GENERATE ──► VERIFY
(profile_data.py)  (gen_pydantic.py)  (gen_needle_instance.py)  (run against real data)
            + discover_relationships.py          + graph gate
```

Run all four, in order, every time. Skipping VERIFY is the most common failure.

### Phase 1 — PROFILE

```bash
python <scripts>/profile_data.py --source <SOURCE> [--table NAME] [--sample 50] --out profile.json
```

`<SOURCE>` is anything: a file path (`data.csv`, `app.log`, `events.jsonl`,
`dump.json`, `table.xlsx`, `db.sqlite`), a database DSN (`mysql://user:pw@host/db`,
`postgres://…`, `sqlite:///path.db` — database profiling runs through the
`usql` CLI when present), or an `https://` URL (fetched, then sniffed).

The profiler detects the source kind automatically, samples real records, and
emits `profile.json`: per-field names, inferred Python types, nullability,
min/max, length bounds, distinct counts, enum candidates, sample values, and —
for log sources — synthesized line templates with capture regexes. Database
declarations win over samples: a DB-declared `ENUM(...)` is captured
complete, and only strings become enum candidates (datetimes never do).
Databases wider than `--max-tables` (default 32) note their dropped tables
in the profile. See `profiler.md` for exactly what it measures and its limits.

**Then run relationship discovery** (see `graph-standards.md`):

```bash
python <scripts>/discover_relationships.py --profile profile.json --out graph_edges.json
```

This emits the property-graph declaration: nodes, candidate edges with
provenance + confidence tiers (`exact_fk` / `candidate`), and — critically —
`disjoint` findings: column pairs that share a NAME but no values, which must
be reported to the user as data-quality facts, never used as joins.

**Read the profile before modeling it.** Look for: surprising nullability,
fields whose "type" is really an enum, dates stored as strings, columns whose
sample values contain units or prefixes (e.g. `NGN46494.89`), and nested
structures in JSON sources. Flag anything suspicious to the user before
proceeding.

### Phase 2 — MODEL

```bash
python <scripts>/gen_pydantic.py --profile profile.json --out models.py [--table NAME] [--model-name Transaction]
```

Emits strict Pydantic v2 models: inferred types with `Field` constraints
(`ge/le` from observed min/max, `pattern` from log templates, `Literal`/`Enum`
from low-cardinality strings), `Optional` where nulls occur, datetime fields
with multi-format parsing validators, `extra="forbid"`, and a description per
field carrying its observed statistics. Every field whose source key differs
from its Python name gets `Field(alias="<source key>")` plus
`populate_by_name=True` — rows arrive keyed by the source's own names, and
without the alias the model rejects them all. Standards and the type-mapping
table: `pydantic-standards.md`.

**Edit the generated model if the data's meaning demands it** — the generator
knows types and ranges, but only you and the user know that `status_code = 2`
means "In Progress". Add enum labels, rename cryptic columns, then move on.

### Phase 3 — GENERATE

```bash
python <scripts>/gen_needle_instance.py --profile profile.json --models models.py --out instance_dir \
    [--db-dsn mysql://user:pw@host/db] [--runtime python|engine] [--agent-name myfeed]
```

Emits a ready-to-run instance directory:

| File | Purpose |
|---|---|
| `needle_menu.json` | the probe menu: profile / peek / count / query / aggregate entries, arguments constrained from the profile |
| `graph_edges.json` | the relationship layer declaration from Phase 1 (nodes, typed edges, disjoint findings) |
| `graph_bridge.py` | runtime graph layer (copied from `graph_bridge.py` in the scripts directory): overview / neighbors / connect over parsed records, built at fetch time |
| `bridge.py` | retrieval + parsing: reads the real source (file, DSN, API) and validates every record through the Pydantic models |
| `instance.py` | the neuralOS agent: menu loaded, triggers set, agentic loop wired, example asks included |
| `README.md` | how to run it, what to ask it, how to extend it |

Generation follows the hard rules in `instance-standards.md` (triggers
mandatory, arguments constrained in the grammar, results kept small via
digest+stash, secrets baked into the executor only, read-only probes first)
and `graph-standards.md` (≤3 graph probes, provenance on every edge, disjoint
honesty, per-fetch construction). For unstructured text sources the generated
bridge uses the model's structured-extraction capability with the Pydantic
schema — see `sources-unstructured.md`.

**Place finished instances in the instances root** (default
`~/neuralos-instances/<name>` — the same directory the `neuralos_list_instances`
/ `neuralos_ask` / `neuralos_graph` / `neuralos_admin` tools read). After
generation the instance is immediately queryable; no restart needed.

### Phase 4 — VERIFY

Never deliver unverified:

1. **Model coverage** — run the generated `bridge` over a real sample: report
   the % of records that parse through the Pydantic model without error.
   Below ~95% means the model is too strict or the data is dirtier than the
   sample showed — widen constraints or add validators, then re-check.
2. **Selection test** — ask the generated instance the same question three
   ways (e.g. "how many…", "count…", "show me the number of…"). All three
   must select the intended probe. **After adding graph probes, re-run the
   FULL selection suite** — new menu entries can degrade existing picks.
3. **Truth check** — compare one relayed number against a direct query of the
   source. The data layer is the only oracle.
4. **Graph gate** (see `graph-standards.md`): every `exact_fk` edge's
   matched-pair count equals a direct source join count; every `disjoint`
   finding appears in a `graph_overview` digest (a graph that hides isolation
   is a bug); one dangling reference verified against the raw source;
   selection of the three graph probes included in the suite.

## Source routing

| Source | Retrieval method | Profiler path | Probe set generated |
|---|---|---|---|
| SQL database | `usql` CLI (any DSN) or `sqlite3` | DSN → information_schema + samples | count / query / aggregate per table |
| CSV / TSV / delimited | direct read, dialect sniffed | path → column inference | peek / filter / count / aggregate |
| JSON / JSONL / NDJSON | direct read, flatten nested | path → schema induction | peek / filter / count |
| Log files (any line format) | direct read, template synthesis | path → templates + capture regexes | parse_tail / count_by_level / search |
| REST API | HTTP + baked auth | URL fetch → sniff (JSON/CSV/text) | endpoint probes per resource |
| Spreadsheets | openpyxl if available | path → sheet/columns | peek / filter per sheet |
| Unstructured text | read + extraction schema | path → templates | extract(record_text) via model |
| Directories of files | iterate + per-file sniff | glob → combined profile | per-file-pattern probes |

Details, edge cases and failure modes per source: `sources-files.md`,
`sources-databases.md`, `sources-apis.md`, `sources-unstructured.md`.

## Instance runtime choice

- **Python runtime** (`--runtime python`, default): the generated
  `instance.py` runs the agentic loop in-process — best when the asking
  happens inside a Python app, script, or an interactive session, and when
  the tools should execute themselves. Requires the `cactus-needle` package
  (`pip install cactus-needle`) in the interpreter that runs it.
- **Windows / PowerShell variant** (Windows hosts where PowerShell is the
  ONLY permitted script runtime — no Python, ever): build phases run on a
  Python-capable workstation (or WSL); the deployed instance carries
  `needle_menu.json` + `graph_edges.json` + a generated `bridge.ps1` with
  `[ValidateSet()]`-caged arguments, generated shape-check validators, and
  the engine (`needle.exe`/`neural.exe`, weights `needle3.cact` or
  `neuralOS.engine`) as the selector. Contract is unchanged; Pydantic is
  build-time only. See `windows-powershell-factory.md` (building) and
  `windows-powershell.md` (running).
- **Engine runtime** (`--runtime engine`): generates a `tools.json` +
  selection-only bridge for the standalone ~1 MB binary — best for servers,
  edge boxes, and non-Python consumers; execution always stays with the
  caller. The app already ships this engine (see `runtime.md`), so no
  download is needed — point the consumer at `<resources>/neuralos/`.

Both share the same menu and the same Pydantic-validated bridge.

## Decision-model seam (optional — laya, offline)

An instance may expose an **env-gated** decision-model side channel
(`LAYA_ROUTER=1`) through **laya** — a local, offline, Apache-2.0 typed
decision model (421M, `pip install laya`) that answers choice/noul/score
questions with calibrated confidence. It is for decision-shaped side jobs
only (guardrails, triage, classify into ≤10 well-described classes) —
**probe selection stays with the engine**: measured on the chinook 37-probe
menu, the 121M engine beat laya 15/18 to 8/18, and the confidence-gated
hybrid degenerated to engine-plus-latency. Rules that are not negotiable:
advisory only, calibrated buckets only (choice ≤10 options, shortlist k=9 +
`no_match` beyond that), and the instance must work perfectly with the
variable unset. `laya_router.py` (in the scripts directory) is the tested,
import-safe router; the full measured verdict and wiring rules live in
`decision-model-integration.md`.

## Operating rules

These are non-negotiable — violating them is what makes small-model agents
unreliable:

1. **Triggers on every menu entry.**
2. **Arguments constrained in the grammar** (patterns, ranges, enums) —
   generated automatically from the profile; do not loosen them without cause.
3. **Tool results small** — counts and digests go to the model; full rows go
   to the caller or a stash file. The generated probes enforce a row cap.
4. **Secrets baked in executors only** — DSN passwords and API keys are written
   into the bridge as constants/env lookups, never as model-facing arguments.
5. **Read-only probes first** — write/update probes are added only after the
   user approves, behind an explicit flag, and always with identity checks.
6. **Verify against the source** — model relays are checked, never trusted.
7. **The graph layer is honest or absent** — edges carry provenance
   (rule + confidence); declared joins that verify with zero value overlap
   become disjoint findings, quoted to the user; the model picks, the bridge
   traverses; graph costs at most 3 menu entries and earns them (a source
   with no real edges gets `graph_overview` alone, or nothing — recorded in
   verification.txt).

Full rationale: `instance-standards.md`.

## Deliverables contract

Every completed run leaves behind, in the chosen `--out` directory:
`profile.json`, `graph_edges.json`, `models.py`, `needle_menu.json`,
`bridge.py`, `instance.py`, `README.md`, and a `verification.txt` recording
the Phase-4 results (model coverage %, selection test, truth check, and the
graph gate: edge truth / disjoint honesty / dangling spot-check). If any
piece is missing, the job is not done.