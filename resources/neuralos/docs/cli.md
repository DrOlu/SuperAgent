# The `needle` CLI

The `needle` command ships with `pip install cactus-needle` (the upstream package name; neuralOS is the product name for it) (in the installing
interpreter's bin dir). Verified against 3.0.2.

```
needle <command> [options]

  run            run a checkpoint on a query (JAX, neuralOS 3)
  finetune       train a LoRA adapter on JSONL data (--layers N for a rung)
  generate-data  synthesise training data via OpenRouter
  build          export a checkpoint (+ adapter) to a .cact archive
  download       needle3 | needle3.safetensors | <platform> | <org>/<repo>[/<file>.cact]
  fetch          fetch the engine library for this platform
  playground     serve the browser playground
```

## run — one-shot generation from the terminal

```
needle run --checkpoint needle3.safetensors \
           --tools tools.json \
           --query "give me revenue breakdown by country" \
           [--max-len N] [--seed N] [--temperature T]
```

- Requires a **JAX training checkpoint** (`--checkpoint`): fetch once with
  `needle download needle3.safetensors` (~242 MB, lands in
  `./checkpoints/`). It is a different artefact from the ~35 MB `needle3.cact`
  deployment archive.
- Requires the `jax` package (`pip install jax`) — **not installed by
  default** with cactus-needle. `needle build` needs jax too.
- `--tools` takes the same JSON array of tool schemas the Python API and the
  engine binary use (produce it with `export_tools.py`, in the app's neuralos scripts directory).
- Output: prints the rendered prompt, then streams the model's completion —
  the tool-call JSON (function_calls with name/arguments, reasoning).
- Deterministic by default (`--temperature 0` = greedy; `--seed` for
  sampling). No date fact is injected — unlike the Python engine — so runs
  are reproducible.
- It does **not** execute tools. Parse the emitted call and run it yourself.

If installing jax is undesirable or impossible, get the identical
deterministic behaviour from the standalone engine binary instead —
see `engine-binary.md`. (You can also fetch a platform bundle jax-free by
calling `needle.agent.fetch.download_platform(...)` from Python, which is
what `bootstrap_engine.py` (in the app's neuralos scripts directory) does.)

## download

| Spec | What you get |
|---|---|
| `needle3` | The base `.cact` weights (~35 MB) into the cache — the Python API's model |
| `needle3.safetensors` | The JAX training checkpoint (~242 MB) into `./checkpoints/` — for `run`/`finetune`/`build` |
| `<platform>` e.g. `macos-arm64`, `windows-x86_64` | That platform's engine bundle into `./<platform>/` |
| `<org>/<repo>[/<file>.cact]` | A fine-tuned or third-party `.cact` archive from Hugging Face |

## fetch — engine library only

```
needle fetch [--out DIR] [--platform-tag TAG] [--generation {2,3}]
```

Fetches just the engine library for this platform into the cache (or
`--out`). `--platform-tag` fetches a build for another device, e.g.
`manylinux2014_aarch64` — useful for preparing an offline Linux box from a
mac.

## build — export a deployable archive

```
needle build [--lora adapter.safetensors] [--layers N] [--out tuned.cact]
             [--platform <platform>] [--upload]
```

- Exports a checkpoint (default: the neuralOS 3 base, auto-downloaded) to a
  `.cact` archive. With `--lora`, merges your fine-tuned adapter first.
- `--layers N` exports the N-layer rung of the ladder (2..20): a smaller,
  faster subnetwork — tuned rungs from 4 layers up can outperform the base.
- `--platform <p>` also downloads that platform's engine bundle and places
  the archive beside it as `needle3.cact`.
- `--upload` pushes the archive to `$NEEDLE_HF_REPO`.
- Needs jax.

## finetune and generate-data — customising

```
pip install "cactus-needle[train]"          # pulls the training stack
needle generate-data --out data.jsonl ...     # synthesise training data via OpenRouter
needle finetune data.jsonl --epochs 10 --out adapter.safetensors [--layers N]
needle build --lora adapter.safetensors --layers 8 --out tuned.cact
```

Training JSONL records use the shape
`{"query": ..., "tools": [...], "function_calls": [...], "reasoning": ...,
"system": ...}` — the same fields the runtime round-trips. Local fine-tuning
trains and exports at 4 bits. Load the result in Python with
`needle.Needle(tools=[...], weights="tuned.cact")` — note `confidence`
becomes `None` (the calibration head is not updated by fine-tuning).

## playground

```
needle playground
```

Serves a local browser playground for trying tools and prompts.

## Cross-platform notes

- **Windows**: the CLI is `needle.exe` in the interpreter's `Scripts\` dir;
  run it via `py -m needle` if PATH is awkward. PowerShell quoting: prefer
  single-quoted `--query 'text'` and avoid nested double quotes.
- **Linux**: identical commands; the engine wheel is manylinux — works on
  x86_64 and arm64, Alpine needs the musl workaround (use the standalone
  binary from a platform bundle instead).
- Checkpoints downloaded by `needle download` land relative to the current
  directory (`./checkpoints/`, `./<platform>/`) — plan paths accordingly in
  scripts.
