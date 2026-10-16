# New-host bootstrap — cold-starting neuralOS (± the laya decision seam)

One sequenced runbook for a completely fresh machine: nothing assumed but
an OS and a shell. Each step has a smoke test; do not continue past a
failing one. Everything here runs offline after the one-time downloads
(needle ~36 MB, laya ~843 MB).

**Naming (every platform).** The CLI answers to `needle` or `neural` and
the weights to `needle3.cact` or `neuralOS.engine` — on macOS, Linux AND
Windows alike. Same runtime, both spellings work everywhere; this page
writes `needle` / `needle3.cact` and you may substitute freely.

## Step 0 — pick the interpreter

Python 3.9+ required; 3.10–3.12 recommended. On a machine with several
Pythons (Homebrew vs python.org vs system), decide NOW which one owns the
stack and use it consistently (`python3.12 -m pip …`, `python3.12 -c …`) —
the #1 fresh-host failure is installing into one interpreter and running
another.

```bash
python3 --version          # or python3.12 --version
```

No Python at all (ever) on this host? Jump to Step 3 — the standalone
engine needs none.

## Step 1 — the needle runtime (Python path)

```bash
python3.12 -m pip install cactus-needle      # Windows: py -m pip install cactus-needle
```

First use auto-downloads the engine + `needle3.cact` (~36 MB) into
`~/.cache/cactus-needle/v3/<engine-version>/` (Windows:
`%USERPROFILE%\.cache\cactus-needle\v3\...`). `NEEDLE3_LIB_PATH` overrides
the library location. Disable telemetry before importing where required:
`NEEDLE_TELEMETRY=0`, `DO_NOT_TRACK=1`.

**Smoke test** (a real tool round-trip — this is the "host is ready" gate):

```bash
python3.12 - <<'EOF'
import needle

@needle.tool
def get_weather(city: str) -> dict:
    """Get the current weather for a city."""
    return {"city": city, "temp_c": 27, "sky": "clear"}

r = needle.Needle(tools=[get_weather]).run("what's it like in Lagos?", max_steps=1)
print(r["results"])   # [{'city': 'Lagos', 'temp_c': 27, 'sky': 'clear'}]  -> ready
EOF
```

Empty `results` or a refusal → see `references/troubleshooting.md` §1/§6
(almost always: wrong interpreter, or missing `triggers`).

## Step 2 — embedding-index capability check (instances with 25+ probes)

`needle.Needle(...).embed("text")` must return a vector (this is what the
instance tool index and drift baselines use):

```bash
python3.12 -c "import needle; v=needle.Needle().embed('hello'); print(len(v), 'dims')"
```

## Step 3 — the standalone engine (no Python at runtime)

For servers, edge boxes, Windows services, and any host where Python is
not permitted at runtime. Fetches the platform bundle + weights, jax-free:

```bash
python scripts/bootstrap_engine.py                  # auto-detects this platform
./macos-arm64/needle --model needle3.cact --tools tools.json --prompt "…"
# Linux/Windows/macOS all also accept:  neural --model neuralOS.engine …
```

Platforms: macos-arm64, linux-x86_64/arm64/armv7/riscv64/mipsel,
windows-x86_64/arm64, plus android/ios/tvos/watchos/wasm. The binary is
call-selection only (it emits the chosen call as JSON; your code executes),
deterministic, ~100 MB RAM, and can serve HTTP (`--serve`, port 8080).

**Smoke test**: run the binary against any `tools.json` — a JSON reply with
`function_calls`, `confidence` and `peak_ram_mb` fields means the engine
bundle is healthy.

Full details: `references/engine-binary.md`; the Windows/PowerShell
deployment (engine + generated `bridge.ps1`, `[ValidateSet()]`-caged) :
`references/windows-powershell.md`.

## Step 4 (optional) — the laya decision seam

Install **only if** this host will make typed judgments (guardrails,
triage, classify into ≤10 well-described classes). Probe/tool selection
stays with needle — the measured verdict lives in the `neuralos` skill.

```bash
python3.12 -m pip install laya          # pulls torch if absent; CPU/mps/CUDA auto
python3.12 -c "from laya import load; load('convaiinnovations/laya')"   # one-time ~843 MB download
```

- First call downloads the checkpoint into
  `~/.cache/huggingface/hub/models--convaiinnovations--laya` — after that,
  offline forever.
- **Air-gapped / thin-pipe hosts:** download the checkpoint ON A FAST,
  connected machine (same `load()` line), then copy the cache directory
  over. 843 MB on a bad pipe is the single worst setup cost in the stack —
  pre-seed by default.
- Throttled CDN: `pip install hf_transfer` +
  `HF_HUB_ENABLE_HF_TRANSFER=1` for parallel chunks.
- Cold load is ~15–20 s **per process**; batch from long-lived processes.

**Smoke test:**

```bash
python3.12 - <<'EOF'
from laya import load
a = load("convaiinnovations/laya")
r = a.system_one("Card charged twice for one order.", {
    "team": {"type": "choice", "instructions": "Which team handles it?",
             "criteria": {"billing": "payment disputes", "tech": "bugs"}}})
print(r["answers"]["team"]["choice"], r["answers"]["team"]["confidence"])
# billing + a calibrated confidence  -> ready
EOF
```

Calibration rule to respect from day one: choice questions ≤10 options
(`choice:11+` confidence is uncalibrated — shortlist to k=9 + `no_match`).
Full reference: the `use-laya` skill.

## Step 5 (optional) — instance building

`pip install pydantic` (v2), then the companion `neuralos` skill takes
over: profile the source → model → generate → verify. Database profiling
opportunistically uses `usql`/`sqlite3`; spreadsheets `openpyxl` — both
optional with graceful fallbacks.

## Readiness checklist (the whole stack in one glance)

| Check | Command | Ready when |
|---|---|---|
| Interpreter | `python3.12 --version` | ≥ 3.9 |
| needle import | `python3.12 -c "import needle"` | no error |
| Tool round-trip | Step-1 smoke script | `results` carries the call's return |
| Embeddings | Step-2 one-liner | prints a dim count |
| Engine binary (if used) | `./needle --model needle3.cact --tools t.json --prompt "x"` | JSON with `function_calls` |
| laya (if used) | Step-4 smoke script | a choice + calibrated confidence |
| laya offline | disconnect network, re-run smoke | still answers |

## Platform notes

- **macOS**: laya auto-picks Apple GPU (mps); needle runs on CPU. Both
  fall back gracefully.
- **Linux**: identical paths; ARM (armv7/arm64/riscv64) covered by the
  engine bundles; laya needs torch on that arch.
- **Windows**: `py -m pip install …`; engine ships as a prebuilt wheel
  (`libneedle3.dll`). On hosts where **PowerShell is the only permitted
  runtime — no Python, ever**: needle is fully deployable (engine +
  `bridge.ps1`, see `references/windows-powershell.md`), but **laya cannot
  live on the box** — it requires Python + torch at call time. Run laya's
  judgments on the jump host / orchestrator and ship the (advisory)
  verdicts to the box; the deployed instance stays needle-only. This
  asymmetry is by design: needle is the action model on the edge, laya the
  judgment model where Python is allowed.
- **Air-gapped estates**: pre-seed BOTH caches from a connected machine —
  `~/.cache/cactus-needle/` (needle engine + weights) and
  `~/.cache/huggingface/hub/models--convaiinnovations--laya` — then nothing
  in the stack ever touches the network again.