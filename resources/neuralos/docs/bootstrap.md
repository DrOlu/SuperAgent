# Bootstrap — a new host with neuralOS in the app

The app is the runtime. The engine binary, the `needle3.cact` weights, the
MCP tools (`neuralos_list_instances` / `neuralos_ask` / `neuralos_graph` /
`neuralos_admin` / `neuralos_docs`), this manual, and the instance-factory
scripts all ship inside the install. **There is no engine to download.**

`neuralos_docs(topic: "index")` prints the exact paths for this install:
the docs directory, the scripts directory, the bundled engine, and the
weights.

## What a new host still needs

1. **A Python interpreter for the instance bridges** (not for selection — the
   bundled engine does that). Python 3.9+ with:
   - `pydantic` v2 (`pip install pydantic`) — every generated bridge validates
     records through it;
   - the source's client library (e.g. `pymysql` for a MySQL instance,
     `psycopg2` for Postgres);
   - `cactus-needle` (`pip install cactus-needle`) **only** if an instance's
     `instance.py` runs the Python agentic loop — the MCP tools don't need it;
   - `usql` on PATH (optional) for database profiling.
   Point the app at it via `NEURALOS_PYTHON` (MCP server settings for the
   neuralos server, or the environment). Default is `python3` on PATH.
2. **An instances root** — `~/neuralos-instances` by default (override with
   `NEURALOS_INSTANCES_DIR`). Copy instances from another machine, or build
   new ones on this host: `factory.md` is the full manual; the scripts it
   references ship beside this one.

## Readiness smoke tests (run in order)

1. `neuralos_list_instances` — returns the instances found in the root. If
   this errors, the instances root is wrong (or empty — build one first).
2. `neuralos_ask` on an existing instance — a plain-English question should
   return a `{pick, confidence, result}` digest. If this errors with
   "engine not found", the bundled engine is missing (reinstall the app);
   if the probe fails, `NEURALOS_PYTHON` points at an interpreter without
   pydantic or the source client.
3. Build a tiny instance end-to-end (`factory.md`, four phases) on a small
   file (a CSV of a few dozen rows works) and ask it three ways. That
   exercises profiler, generators, bridge, engine selection, and the
   verification contract in one pass.

## Special hosts

- **Windows / PowerShell-only** (no Python ever): the engine is bundled, and
  instances can execute through a generated `bridge.ps1` — see
  `windows-powershell.md`. Build phases need a Python-capable workstation
  (or WSL) — `windows-powershell-factory.md`.
- **Never-touch-network hosts**: the bundled engine and the MCP tools are
   fully offline. Only the Python package's first-use auto-download
   (`~/.cache/cactus-needle/…`) touches the network — avoid it by using the
   bundled engine (or pre-seed the cache from another box).
- **macOS x64**: no engine binary is published for Intel Macs — the app falls
   back to the instances-dir engine (`<instancesRoot>/engine/needle` +
   `needle3.cact`) or an explicit `NEURALOS_ENGINE_BIN`/`NEURALOS_ENGINE_WEIGHTS`
   override. The Python package's wheel covers Intel macOS, so the in-process
   runtime (`pip install cactus-needle`) works there too.

## Multi-Python gotcha

On machines with several Pythons (Homebrew vs python.org vs system), `pip
install` puts `needle`/pydantic into ONE interpreter's site-packages. If a
bridge import fails, verify the interpreter: `python -c "import pydantic,
pymysql"` with the exact binary configured in `NEURALOS_PYTHON` — not just
`python3` on PATH.