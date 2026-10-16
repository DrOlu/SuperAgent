# Troubleshooting neuralOS

Every entry below was observed live (cactus-needle 3.0.2, macOS arm64)
unless marked otherwise. Symptoms link back to the rules in
`tool-design.md`.

## Table of contents

§1 `ModuleNotFoundError: No module named 'neuralOS'`
§2 `{"error": "ungrounded password"}` (or any `ungrounded <arg>`)
§3 Model fills nonsense arguments (`host='mysql'`)
§4 Same tool called over and over until max_steps
§5 Third request of a compound ask never executes
§6 Refusal with high confidence, no tool call
§7 `needle run` / `needle build` demand jax
§8 Garbled unicode in results
§9 Script runs but "no output" (macOS)
§10 `ExtractionValidationError` from `extract()`
§11 Windows specifics
§12 Prompt does not fit / unparseable envelope

## §1 ModuleNotFoundError: neuralOS

Multi-Python machines (Homebrew + python.org + system) install the `needle`
package into one interpreter only. Symptoms: `import needle` fails under
`python3` (`ModuleNotFoundError: No module named 'needle'`); the `needle` CLI
exists in one bin dir but plain `python3 script.py` cannot import it.

Fix — find the owning interpreter and use it:

```bash
# which interpreter has it?
pip show cactus-needle            # Location: .../site-packages
ls /Library/Frameworks/Python.framework/Versions/*/bin/needle 2>/dev/null
```

Or make the script self-healing — re-exec into the right interpreter before
the failure reaches the user:

```python
try:
    import needle
except ImportError:
    import os, sys
    fw = "/path/to/python-that-has-neuralOS"
    if sys.executable != fw and os.path.exists(fw):
        os.execv(fw, [fw, os.path.abspath(__file__)] + sys.argv[1:])
    raise SystemExit(f"pip install cactus-needle into {fw}")
```

(Guard `sys.executable != fw` so a failure there cannot loop.)

## §2 `{"error": "ungrounded password"}`

Strict grounding refused to pass a value it could not verify against the
input — observed with secrets by design. Fix: bake credentials as constants;
keep only request-varying values as arguments (`tool-design.md` §4). If the
flagged argument is *not* a secret, the model fabricated it — give the
argument a default or write the value into the request text.

## §3 Model fills nonsense arguments (`host='mysql'`)

A 121M model will happily read "connect to the **MySQL** server" as
`host="mysql"`. Fixes, in order of strength: make the tool parameterless when
the value is fixed infrastructure; constrain the argument
(`pattern="^[A-Za-z0-9_.-]+$"`); phrase the request as the action, not the
connection ("List all databases on the local MySQL server", not "Connect
to the MySQL server on … and list…").

## §4 Same tool called over and over until max_steps

Cause: the tool's return value — fed back verbatim into the prompt — was too
large (observed with a ~4 KB schema dump). The model loses the thread and
re-issues calls. Fix: digest + stash (`tool-design.md` §5) — return counts
and names, keep the payload in a variable the caller reads. Verify by
watching the tool-invocation log lines drop to one per turn.

## §5 Third request of a compound ask never executes

"Two things → two calls in order" is the reliable ceiling; a three-part
ask dropped the third in testing. Split into follow-up turns; in `--prompt`
/ CLI mode, issue one intent per invocation.

## §6 Refusal with high confidence, no tool call

The model answers "No connectivity or network tools available" (or similar)
instead of calling a perfectly matching tool. Causes: missing `triggers`
(the usual one); the Python engine's auto-injected `date:` fact drifting
between runs and flipping selection. Fixes: add triggers; re-run; for
reproducibility use the CLI (`needle run`, greedy, no date fact) or the
standalone engine binary, or pin the system fact
(`needle.Needle(..., system="date: 2026-09-18", auto_date=False)`).

## §7 `needle run` / `needle build` demand jax

`ModuleNotFoundError: No module named 'jax'` — the training-side commands
import JAX, which `pip install cactus-needle` does not include. Either
`pip install jax` (+ `needle download needle3.safetensors`, ~242 MB), or
skip both entirely: the standalone engine binary gives the same
deterministic output with no jax and no checkpoint
(`engine-binary.md` — or `scripts/bootstrap_engine.py`). To merely *download*
a platform bundle without jax, call
`needle.agent.fetch.download_platform(...)` directly.

## §8 Garbled unicode in results (…)

- Wrapping a CLI: set `encoding="utf-8", errors="replace"` on
  `subprocess.run`, and the CLI's own charset flag (mysql:
  `--default-character-set=utf8mb4`) — see `tool-design.md` §7.
- Still mangled? The source data may already be corrupted. Check what is
  actually stored before blaming the pipe: `SELECT col, HEX(col) ...` —
  `EF BF BD` inside the stored bytes is U+FFFD baked in at load time
  (lossy import). No client flag can resurrect lost bytes; re-import the
  data or report the names as-is.

## §9 Script runs but "no output" (macOS)

- Running with an interpreter that lacks neuralOS → §1 (traceback on stderr).
- **Double-clicking the .py in Finder** → the window flashes the output and
  closes instantly. Run from Terminal (`./script.py` with a shebang, after
  `chmod +x`).
- Give long-running scripts an immediate `print("Loading...", flush=True)`
  before engine init so silence never looks like a hang.

## §10 `ExtractionValidationError` from `extract()`

The extracted values were not grounded in the input: a temporal value
contradicting a literal year in the text, or engine-reported fabricated or
negated values. Fix the input or schema (make the field optional, widen the
enum), or pass `strict=False` to get the raw values back and validate
yourself — accepting that ungrounded data may flow through.

## §11 Windows specifics

- Engine binary is `needle.exe`; no `chmod` concept — `download_platform`
  marks it executable already.
- SmartScreen/Defender may flag the unsigned binary on first run — unblock
  in the file's Properties (false positive), or submit for whitelisting.
- Cache: `%USERPROFILE%\.cache\cactus-needle\v3\<version>\`.
- CLI invocation via `py -m needle` sidesteps PATH issues; in PowerShell
  quote prompts single-quoted: `--prompt 'give me the top customers'`.
- jax installs fine on Windows but is only needed for `run`/`build`/finetune
  — prefer the engine binary for production use.

## §12 Prompt does not fit / unparseable envelope

- "Prompt (N tokens) does not fit in max_seq_len" (CLI) — trim tool
  descriptions, drop tools, or split the tool set with `--tool-index`.
- Python engine: raise `buffer_size=` in `needle.Needle(...)` for long
  prompts/results.
- "engine returned an unparseable envelope" — a genuine engine bug per the
  library's own error text: report it upstream with the prompt and schema.
- `--fail-input-overflow` on the engine binary turns silent trimming into a
  hard error — use it when you would rather know than lose context.
