# The standalone engine binary (no Python at runtime)

The same `needle3.cact` weights run through a raw-C engine as a single
executable — no JAX, no Python, no interpreter. This is the surface for
servers, Windows boxes, edge devices, and embedding tool-calling in a larger
program. Verified live on macOS arm64 with 3.0.2; Linux/Windows paths checked
against the fetch machinery.

## 1. Get a platform bundle

17 published platforms:

| OS | Platforms |
|---|---|
| macOS | `macos-arm64` |
| Linux | `linux-x86_64`, `linux-arm64`, `linux-armv7`, `linux-riscv64`, `linux-mipsel` |
| Windows | `windows-x86_64`, `windows-arm64` |
| Mobile/other | `android-arm64`, `android-armv7`, `android-riscv64`, `ios-arm64`, `ios-sim-arm64`, `tvos-arm64`, `watchos-arm64`, `wasm`, `wasm-component` |

Three ways to fetch (all land in `./<platform>/` relative to cwd unless you
pass a destination):

```bash
# A. The documented way — needs jax (often not worth it just to download)
needle build --platform macos-arm64

# B. Jax-free — call the fetch machinery directly (what bootstrap_engine.py does)
python -c "from needle.agent import fetch; \
  fetch.download_platform('macos-arm64', '.', generation=3)"

# C. This skill's bundled script — auto-detects the platform, copies weights,
#    prints the run command (works the same on macOS/Linux/Windows)
python scripts/bootstrap_engine.py [--platform <p>] [--dest DIR]
```

The bundle ships **`needle` (`needle.exe` on Windows), `libneedle.a`,
`needle.h` — but no weights**. Copy the base weights beside the binary:

```bash
cp ~/.cache/cactus-needle/v3/*/needle3.cact ./macos-arm64/
# Windows: copy %USERPROFILE%\.cache\cactus-needle\v3\*\needle3.cact
```

(`bootstrap_engine.py` does this for you; the weights download on demand if
not cached. For a fully offline target, copy the whole folder over.)

## 2. Run it

From the bundle directory (engine `--help`, verbatim):

```
./needle [--model needle3.cact] [--tools tools.json] [--system system.txt]
         [--prompt "..."] [--serve] [--port N] [--max N] [--depth N]
         [--threads N] [--forced] [--fail-input-overflow] [--tool-index path]

  --model needle3.cact     the weights to run (required unless this build embeds them)
  --tools tools.json       the functions the assistant may call, as a JSON array
  --tool-index path        file holding this tool set's embeddings, reused when the schemas match
  --system system.txt      session facts like date, locale, or device
  --prompt "..."           answer one query and exit
  --max N                  response token limit (default 512)
  --depth N                endpoint-preserving ladder depth (2..full; default full)
  --threads N              worker threads (default: the device's fast cores, at most 4)
  --forced                 benchmark mode: always dispatch a call when tools are offered
  --fail-input-overflow    refuse a turn that would not fit the context window instead of trimming it
  --serve [--port N]       run an HTTP server (default port 8080)
```

One-shot:

```bash
./needle --model needle3.cact --tools tools.json \
    --prompt "give me revenue breakdown by country"
```

```powershell
# Windows
.\windows-x86_64\needle.exe --model needle3.cact --tools tools.json --prompt "..."
```

Output is one JSON object on stdout:

```json
{"type":"call","success":true,"error":null,"function_calls":
 [{"name":"chinook_revenue_by_country","arguments":{}}],
 "suppressed_calls":[],"reasoning":"...","confidence":0.6755,
 "prefill_tps":1172.9,"decode_tps":564.4,"peak_ram_mb":96.7,
 "validation":{"ungrounded":[],"negation":false}}
```

`prefill_tps` / `decode_tps` / `peak_ram_mb` are real measurements from the
run — useful for capacity-planning edge boxes. Reference numbers from an
M-series laptop: ~1170 tok/s prefill, ~560 tok/s decode, ~97 MB peak RAM.

## 3. Semantics — what the binary does and does not do

- **Call-selection only.** It emits the chosen call(s); it never executes
  anything. Your surrounding code parses `function_calls` and runs the
  action. There is no built-in result-feedback loop in `--prompt` mode —
  build one by POSTing the executed result back as a new input, or use the
  Python API's `run()` if you want the loop handled.
- **Deterministic.** Greedy decode, no date fact injected. Same prompt +
  tools → same output, which makes it testable and CI-friendly (unlike the
  Python engine's drifting `date:` fact).
- **`--system system.txt`** supplies session facts (date, locale, device)
  as a text file. Give it a fixed date when you want temporal grounding to
  have a year to reason from.
- **`--forced`** disables low-confidence call suppression — use for
  benchmarking tool-selection accuracy, not production.
- **`--depth N`** runs a shallower ladder rung — faster, slightly weaker;
  useful on very small devices.
- **`--tool-index path`** stores/reuses tool embeddings so large tool sets
  are re-indexed only when schemas change.

## 4. HTTP server mode

```
./needle --model needle3.cact --tools tools.json --serve [--port 8080]
```

- `POST /complete` with JSON body `{"input": "user request"}` → the same
  response object as `--prompt` mode.
- **The body parser is whitespace-sensitive**: only the tight form
  `{"input":"..."}` parses. A space after the colon (`{"input": "..."}` —
  what Python's default `json.dumps` emits) or pretty-printed JSON is
  *silently* mis-parsed with no HTTP error, and the model then hallucinates a
  call (typically a default probe plus `validation.ungrounded` entries).
  Build bodies with `json.dumps(payload, separators=(",", ":"))` or jq `-c`,
  and add a response assertion (expect a known field in `function_calls[0]`)
  in anything that automates this endpoint.
- `POST /reset` → clears conversation state.
- Nothing else runs on the port; keep it on localhost or behind your own
  auth — anyone who can reach it can drive your tool *selection* (execution
  remains wherever you implement it).

## 5. Embedding in C

The bundle's `needle.h` + `libneedle.a` expose the same C API the binary
itself uses (`needle_init`, `needle_complete`, `needle_embed`,
`needle_reset`, `needle_load` — see the header for signatures). The Python
package loads a dynamic variant of the same library from
`~/.cache/cactus-needle/v3/<version>/`. If the C surface grows beyond this,
check the header that shipped with your bundle — it is the authoritative
reference for your version.

## 6. Windows notes

- Binary is `needle.exe`; `download_platform` sets the executable bit
  automatically (no `chmod` needed anywhere).
- If Windows Defender or SmartScreen flags the unsigned binary on first run,
  that is a false positive — unblock the file in its Properties dialog, or
  submit it to the vendor for whitelisting.
- Paths: cache lives at `%USERPROFILE%\.cache\cactus-needle\v3\<version>\`.
- PowerShell: quote `--prompt 'text'`; avoid nested double quotes.
- The WinRM/SSH pattern for provisioning a Windows server: run
  `bootstrap_engine.py` on the target (needs Python + `pip install
  cactus-needle` once), or copy the folder in — it is fully self-contained
  afterwards.
