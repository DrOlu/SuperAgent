# Windows / PowerShell variant — building neuralOS instances without Python at runtime

Some Windows environments allow only PowerShell to write and run scripts —
no Python, ever (locked-down servers, policy-gated hosts, Windows Sandbox
images). The instance workflow still works end-to-end there; only the
execution surface changes. The rule this variant follows:

> **Build where Python exists; run where PowerShell exists.**

## The two-machine split

| Phase | Where it runs | What it produces |
|---|---|---|
| PROFILE + MODEL + GENERATE | a workstation with Python (or WSL on the same box — WSL counts as the workstation) | `profile.json`, `graph_edges.json`, `models.py`, `needle_menu.json`, `graph_bridge.py`, and the **generated PowerShell bridge** |
| RUNTIME (probe calls, admin probes) | the Windows box, PowerShell only | engine selection via `needle.exe` / `neural.exe`, execution via `bridge.ps1` |

Python is never required **at runtime**. The Pydantic models still exist —
they are used at build time to GENERATE the PowerShell field validators
(required fields, types, enum membership) that `bridge.ps1` enforces with
`ConvertFrom-Json` + explicit checks. The strict-model contract becomes
"shape-checked by generated validators", documented as such — slightly
lighter than Pydantic at runtime, identical at the digest boundary.

## Layout on the Windows box

```
C:\neuralos\<instance>\
  needle_menu.json      engine menu (same file, unchanged)
  graph_edges.json      relationship declarations (same file, unchanged)
  bridge.ps1            PowerShell bridge — the ONLY thing that touches the source
  verify.ps1            Phase-4 runner (coverage counts, truth checks)
  windows-x86_64\       engine bundle copied from the workstation
    needle.exe          (or neural.exe — same engine, either name)
    needle3.cact        (or neuralOS.engine — same weights, either name)
    libneedle.a, needle.h
```

The engine is self-contained: copy the whole `windows-x86_64\` folder over
(preferred on Python-less boxes — `download_platform` and
`bootstrap_engine.py` are Python-side conveniences). Both binary names and
both weight names work:

```powershell
.\windows-x86_64\needle.exe --model needle3.cact --tools needle_menu.json --prompt "aws overview"
.\windows-x86_64\neural.exe --model neuralOS.engine --tools needle_menu.json --prompt "aws overview"
```

## bridge.ps1 — the operating rules, in PowerShell

Same rules as `instance-standards.md`, PowerShell idioms:

```powershell
# bridge.ps1 — every probe: select, validate, cap. Secrets NEVER here.
# Creds: env vars first, else Windows Credential Manager (see below).
$ROW_CAP = 25
$VALIDATION = @{ parsed = 0; failed = 0; errors = @() }

function Get-Creds {
    if ($env:AWS_ACCESS_KEY_ID -and $env:AWS_SECRET_ACCESS_KEY) {
        return @{ ak = $env:AWS_ACCESS_KEY_ID; sk = $env:AWS_SECRET_ACCESS_KEY }
    }
    # Windows Credential Manager is the PowerShell equivalent of the
    # keychain->scrt vault lookup: never plaintext in the file.
    $cred = Get-StoredCredential -Target "aws-mrolu"   # CredentialManager module
    return @{ ak = $cred.UserName; sk = $cred.GetNetworkCredential().Password }
}

# Arguments are grammar-caged with [ValidateSet()] — the PowerShell twin of
# the menu's enum constraint. The model may fill arguments; this validates.
function Get-AwsInstances {
    param(
        [ValidateSet("all", "running", "stopped")]
        [string]$State = "all"
    )
    # ... fetch live data, then SHAPE-CHECK every record before it reaches
    # the caller (generated from models.py at build time):
    $rows = @()
    foreach ($r in $fetched) {
        $ok = ($r.instance_id -match '^i-[0-9a-f]{17}$') -and
              ($r.state -in @("pending","running","shutting-down","stopping",
                              "stopped","rebooting","terminated"))
        if ($ok) { $VALIDATION.parsed++ ; $rows += $r }
        else     { $VALIDATION.failed++ ; $VALIDATION.errors += "instance: $($r.instance_id)" }
    }
    # Results small — always a capped digest with totals, never a dump.
    @{ state_filter = $State; total_all_states = $fetched.Count;
       by_state = ($fetched | Group-Object state |
                   ForEach-Object { $_.Name; $_.Count });
       instances = @($fetched | Select-Object -First $ROW_CAP) }
}

function Start-AwsPower {
    param(
        [string]$InstanceId,
        [ValidateSet("start", "stop", "reboot")] [string]$Action,
        [ValidateSet("yes")]                     [string]$Confirm   # interlock
    )
    if ($Confirm -ne "yes") { return @{ error = "refused: confirm='yes' required" } }
    # identity-check first, then act — same contract as the Python bridges
}
```

- **Errors are data**: a failed retrieval returns `@{ error = ... }`, never throws.
- **Secrets**: env vars first, else Windows Credential Manager (`CredentialManager` module) — never model-facing arguments, never plaintext in the file.
- **Graph layer**: `graph_edges.json` loads with `ConvertFrom-Json`; edges verify with hashsets (`$set = [System.Collections.Generic.HashSet[string]]::new()`); the ≤3 graph probes and the disjoint-honesty contract are unchanged.
- **Engine invocation from PowerShell**: JSON body building for `--serve` mode MUST be compressed — PowerShell's default `ConvertTo-Json` emits spaces after colons, which silently mis-parses: always `ConvertTo-Json -Compress`. The same trap as Python's `separators=(",",":")`.

## Phase 4 verification on Windows (verify.ps1)

Same three gates, PowerShell equivalents:

1. **Coverage** — run every read probe, count shape-check passes/failures into
   `$VALIDATION`, print the percentage (gate: >=95%).
2. **Selection** — run the engine three times per phrasing
   (`needle.exe --prompt "..."`), parse the response with `ConvertFrom-Json`,
   assert `function_calls[0].name` is the intended probe. The engine is
   deterministic; the test is stable.
3. **Truth check** — one relayed number vs a direct native-client query
   (`aws` CLI, `Invoke-RestMethod` to Cloudflare, `Invoke-Sqlcmd` to SQL
   Server, etc.). The source is the only oracle.

Record all three in `verification.txt`, same as any instance.

## What does NOT change

- `needle_menu.json`, `graph_edges.json`, triggers, grammar-caged arguments,
  ROW_CAP, confirm interlocks, verification contract, the four-phase
  workflow itself.
- The engine runs identically on Windows (see the neuralos-skill
  `windows-powershell.md` reference for engine specifics: `needle.exe`,
  Defender first-run flags, service embedding).

## What DOES change

- **models.py exists at build time only** — on the Windows box it is
  documentation + the generator's source for the `.ps1` validators, never
  imported.
- The bridge is `bridge.ps1`, not `bridge.py`; the Pydantic contract is
  replaced by generated PowerShell shape-checks (state this in the
  instance's README).
- The Python agentic loop (`instance.py`, `needle.Needle`) is unavailable
  on this surface: selection comes from the engine binary, execution from
  PowerShell — the "engine runtime" arrangement, with PowerShell as the
  executor.