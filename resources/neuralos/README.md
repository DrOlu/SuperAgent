# resources/neuralos — engine payload + factory scripts + manual

The neuralOS engine is vendored from the **`neuralos` npm package** into
`engine/` by `scripts/vendor-neuralos-engine.mjs`, which the release
workflows run before electron-builder. The whole directory is bundled into
the installed app at `<resources>/neuralos/` via the `extraResources` entry
in electron-builder.yml.

**Committed here:** this README, `scripts/` (the factory pipeline the
`neuralos_factory` tool runs: profile_data.py, discover_relationships.py,
gen_pydantic.py, gen_needle_instance.py) and `docs/` (the bundled manual the
`neuralos_docs` tool serves).

**Placed at build time only** (vendored, not committed) —
`engine/node_modules/` holds a self-contained npm tree:

- `neuralos/` — the package's JS glue + CLI (`cli.js`); the runtime spawns
  `cli.js run --tools <menu> --query <question> --max-steps 0` through the
  Electron binary itself (`ELECTRON_RUN_AS_NODE=1`)
- `koffi/` — the FFI binding, pruned to the prebuilds the target platform needs
- `neuralos-darwin-arm64/`, `neuralos-darwin-x64/`,
  `neuralos-linux-x64-gnu/`, `neuralos-linux-arm64-gnu/`,
  `neuralos-engine-windows-x64/` — per-platform payloads, each carrying
  `bin/libneedle3.*` + `bin/needle3.cact` (~35 MB weights)

Each artifact vendors only its target's payloads (mac: both darwin payloads,
linux: both glibc payloads, win: x64 — npm publishes no win32-arm64 payload,
so Windows-arm64 falls back to the instances-dir/env candidates, as
documented in `docs/bootstrap.md`). The old standalone engine binaries and
the pinned Hugging Face revision are no longer used.

Source: https://www.npmjs.com/package/neuralos (version pinned in the vendor
script, overridable with `NEURALOS_NPM_VERSION`). Local builds: run
`node scripts/vendor-neuralos-engine.mjs`, or point `NEURALOS_ENGINE_DIR` at
any directory holding a plain `npm i neuralos` tree — see `docs/runtime.md`.
