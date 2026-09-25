# neuralOS — on-device tool calling

> **Branding scope.** neuralOS is the product name. The runtime binaries and
> the Python package keep their upstream names — `needle`, `cactus-needle`,
> `needle3.cact` — and every command in this manual uses those real names so
> nothing here is aspirational. Visible name: neuralOS. Functional name:
> needle. **On every platform — macOS, Linux and Windows alike** — the CLI
> may be invoked as either `needle` or `neural` and the weights as either
> `needle3.cact` or `neuralOS.engine`: same runtime, both spellings work
> everywhere. `windows-powershell.md` covers the Windows-specific no-Python
> deployment; the naming aliases themselves are platform-independent.

neuralOS is a foundation model built for tiny devices: a single 121M-parameter
"Simple Attention Network" quantised to 2-bit, shipped as one ~35 MB weights
file (`needle3.cact`) plus an engine library under 1 MB. It runs offline on a
CPU — roughly 100 MB of RAM, hundreds of tokens per second on a laptop — with
no API key, no GPU and no network. It does three things:

1. **Tool calls** — given your function schemas and a plain-English request, it
   picks the right function and fills every argument from what was said. Ask
   for two things and you get two calls in order; ask for something no tool
   covers and you get an empty list, not a guess.
2. **Structured extraction** — declare a shape, hand over messy text, get
   typed fields back; the decode grammar guarantees the output parses.
3. **Text embeddings** — a vector for a sentence (neuralOS 3 only).

The app ships the standalone engine binary + the `needle3.cact` weights in its
`neuralos` resources directory — `neuralos_docs(topic: "index")` prints the
exact paths for this install. The `neuralos_ask` / `neuralos_graph` /
`neuralos_admin` tools use that engine for probe selection and run the
instance bridges with a configured Python interpreter (`NEURALOS_PYTHON`).

For the companion manual that turns raw data sources into neuralOS
instances (profile any source → Pydantic models → generated menu, bridge and
agent), see `factory.md`.

The model is tiny (121M params). It is reliable **when tools are designed for
it** — the rules in "Tool design" below are not optional polish, they are the
difference between a working agent and a flaky one.

## Pick a surface

| Your situation | Surface | Read |
|---|---|---|
| Python app/script; agent loop that **executes** the tools it calls | Python API — `import needle` | `python-api.md` |
| No Python at runtime — servers, Windows services, edge devices, embedding in C | Standalone engine binary — `./needle --model needle3.cact` (the app ships it) | `engine-binary.md` |
| **Windows hosts where PowerShell is the ONLY permitted runtime** (no Python, ever) | Engine selection + PowerShell execution loop — `needle.exe` / `neural.exe` | `windows-powershell.md` |
| You need a typed **judgment** (guardrail, triage, classify into ≤10 classes), offline — not a tool call | laya decision model — `pip install laya` | `decision-models.md` |
| Setting up a host (interpreter for the bridges, instances directory, smoke tests) | `bootstrap.md` |
| The model picked the wrong tool / refused / looped / mangled args | Tool design rules (read this before debugging anything else) | `tool-design.md` |
| It errored or behaved oddly | Symptom table | `troubleshooting.md` |

## Install (Python runtime only)

```
pip install cactus-needle          # Python 3.9+; macOS, Linux, Windows
```

The standalone engine ships with the app — no download needed for selection.
Install the Python package only when an instance's `instance.py` runs the
agentic loop in-process (the Python runtime).

- On **Windows**, prefer `py -m pip install cactus-needle`. The engine ships
  as a prebuilt wheel (`libneedle3.dll`) — no compiler needed.
- First use of the Python package auto-downloads its engine + `needle3.cact`
  weights into `~/.cache/cactus-needle/v3/<engine-version>/` (~36 MB). Set
  `NEEDLE3_LIB_PATH` to override. (This is independent of the app-bundled
  engine — both work off the same weights format.)
- If the machine must never touch the network, use the app-bundled engine
  binary for selection instead.
- Telemetry is on by default. Disable before importing:
  `NEEDLE_TELEMETRY=0` and `DO_NOT_TRACK=1`.
- **Multi-Python gotcha:** on machines with several Pythons (Homebrew vs
  python.org vs system), the `needle` CLI lives in the interpreter's bin dir
  that `pip install`ed it. If `import needle` fails under `python3`, find the
  right interpreter (`ls */bin/needle`, `pip show cactus-needle`) — or see
  the re-exec pattern in `troubleshooting.md`.

## Quick start (Python API)

```python
import needle

@needle.tool
def get_weather(city: str) -> dict:
    """Get the current weather for a city."""
    return {"city": city, "temp_c": 27, "sky": "clear"}

agent = needle.Needle(tools=[get_weather])
response = agent.run("what's it like in Lagos right now?")
print(response["results"])   # [{'city': 'Lagos', 'temp_c': 27, 'sky': 'clear'}]
```

The decorator reads the signature for argument types and the docstring for
the tool description (an `Args:` section documents parameters). `run()` picks
the tool, executes it **in-process**, feeds the return value back to the
model, and returns the final response. Full API — including `Field`
constraints, extraction and embeddings — in `python-api.md`.

## Tool design — the rules that make a 121M model reliable

These came from live failure modes, not style guides. Details and code
patterns in `tool-design.md`.

1. **Give every tool `triggers`.** `@needle.tool(triggers=["list databases",
   ...])`. Without them, tool selection is flaky — the model intermittently
   refuses a perfectly matching tool ("no connectivity or network tools
   available", often with high confidence).
2. **Never make secrets tool arguments.** neuralOS's strict grounding blocks
   arguments it cannot verify against the input (`ungrounded password`), and
   secrets should not travel through an LLM anyway. Bake credentials into
   constants; let the model pick *what* to do, not recite keys.
3. **Keep the result you return small.** `run()` feeds your tool's return
   value verbatim back to the model. A multi-kilobyte result makes a 121M
   model lose the thread and repeat unrelated calls until `max_steps`. Return
   a compact digest and keep the full payload in a variable the caller reads.
4. **Two asks per turn, maximum.** "Do X then Y" reliably yields two calls in
   order; a three-part compound drops the third. Split into follow-up
   questions.
5. **Judge success by `response["results"]`, not by the final turn.** After
   execution the final response has `function_calls: []` and
   `type: "respond"` — that is success, not refusal.
6. **Constrain arguments in the grammar, don't hope.** `Field`/`Annotated`
   with `ge/le`, `pattern`, `enum`, `const`, or `Literal` types make invalid
   values unrepresentable. The tiny model *will* otherwise fill `host='mysql'`
   from the word "MySQL" in your prompt.
7. **The Python engine injects a date fact** (`date: YYYY-MM-DD HH:MM`) into
   every prompt by default; the minutes drift between runs and can flip tool
   selection. For reproducibility pass a fixed `system=` and
   `auto_date=False`. The standalone engine doesn't inject dates.

## Standalone engine (no Python at runtime)

The raw-C engine binary runs the same `needle3.cact` weights with no JAX, no
Python — ideal for servers and Windows boxes. **The app ships this engine +
weights already** (`neuralos_docs(topic: "index")` prints the paths):

```bash
# macOS / Linux — the bundled engine
<resources>/neuralos/engine-macos-arm64 --model <resources>/neuralos/needle3.cact \
    --tools tools.json --prompt "give me revenue breakdown by country"

# to fetch a platform bundle for another machine instead:
python <scripts>/bootstrap_engine.py            # auto-detects this platform
```

```powershell
# Windows
python <scripts>\bootstrap_engine.py --platform windows-x86_64
.\windows-x86_64\needle.exe --model needle3.cact --tools tools.json --prompt "..."
```

The binary is **call-selection only**: it emits the chosen call as JSON
(name, arguments, reasoning, confidence, throughput stats) and does **not**
execute anything — your code runs the tool. It is deterministic (greedy
decode), needs ~100 MB RAM, and can also serve HTTP (`--serve`, default port
8080: `POST /complete {"input": "..."}`, `POST /reset`). Platforms:
macos-arm64, linux-x86_64/arm64/armv7/riscv64/mipsel,
windows-x86_64/arm64, plus android, ios, tvos, watchos and wasm variants.
Full details in `engine-binary.md`.

## Bundled scripts

All in the scripts directory (`neuralos_docs(topic: "index")` prints the path):

- `bootstrap_engine.py` — jax-free download of any platform's engine bundle +
  weights, prints the exact run command. Cross-platform.
- `export_tools.py` — dump the `@needle.tool` schemas from a Python module
  into `tools.json` for the engine binary.
- `profile_data.py` / `gen_pydantic.py` / `gen_needle_instance.py` /
  `discover_relationships.py` / `graph_bridge.py` / `laya_router.py` — the
  instance factory; see `factory.md`.

## Decision model for judgments (laya, offline)

neuralOS picks tools and writes their arguments — an **action model**. For
**judgment-shaped** work in the same app (guardrails, triage, severity
scoring, classify into ≤10 well-described classes) the fleet's offline
package of choice is **laya** (`convaiinnovations/laya`, Apache-2.0,
`pip install laya`, no cloud, no key, free per call): state + typed
choice/noul/score questions in, picks + probabilities + calibrated
confidence out. Keep it advisory and env-gated, keep choices ≤10 options
(above that laya's confidence is uncalibrated), and do NOT use it for
tool/probe selection — the measured verdict is that the 121M engine beats
the 421M decision model at selection (15/18 vs 8/18 on a 37-probe menu).
Full split and wiring pattern: `decision-models.md`; the factory-side
measured pilot: `decision-model-integration.md`.

## Troubleshooting quick table

| Symptom | Cause → fix |
|---|---|
| `ModuleNotFoundError: neuralOS` | Wrong interpreter → `troubleshooting.md` §1 |
| Result says `ungrounded password`/`ungrounded <arg>` | Grounding blocked a secret/fabricated value → §2 |
| Model fills nonsense (`host='mysql'`) | Unconstrained string arg → triggers + constraints → §3 |
| Same tool called repeatedly until max_steps | Tool result too large fed back → digest+stash → §4 |
| Third request of a compound ask never happens | 2-ask limit → split the ask → §5 |
| Refusal with high confidence, no call | Missing triggers / date-fact drift → §6 |
| `needle run`/`build` demand jax | Use the engine binary path instead → §7 |
| Garbled unicode in outputs | Charset on the wrapped CLI / corrupted source data → §8 |
| Nothing happens on macOS double-click | Window flashes closed — run from Terminal → §9 |

Expanded causes and fixes: `troubleshooting.md`.