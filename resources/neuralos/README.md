# resources/neuralos — build-time engine download

The neuralOS engine binary and weights are downloaded into this directory
by the release workflows (`Download neuralOS engine + weights` step) and
bundled into the installed app at `<resources>/neuralos/` via the
`extraResources` entry in electron-builder.yml. Nothing here is committed
except this README, so local builds always have a valid source dir.

Files placed at build time:
- `needle3.cact` — the 35 MB weights (platform-independent)
- `engine-macos-arm64` — macOS Apple Silicon (no x64 engine is published)
- `engine-linux-x86_64`, `engine-linux-arm64`
- `engine-windows-x86_64.exe`, `engine-windows-arm64.exe`

Source: https://huggingface.co/Cactus-Compute/needle3 (`needle3.cact`,
`<platform>/needle[.exe]`). Local builds: run the same curl commands the
workflows use, or the app falls back to `<NEURALOS_INSTANCES_DIR>/engine/`
or `NEURALOS_ENGINE_BIN`/`NEURALOS_ENGINE_WEIGHTS`.
