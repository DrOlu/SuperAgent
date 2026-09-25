# Windows / PowerShell — running the engine with no Python

The PowerShell variant of neuralOS: Windows boxes where PowerShell is the
only permitted script runtime (no Python at runtime). The engine binary is
self-contained, so everything works — selection via the engine, execution
via PowerShell. Content elsewhere in this manual is unchanged; this page is
the Windows/PowerShell variant of it.

> **Naming.** The engine answers to either name — `needle` (upstream binary)
> or `neural` — and the weights to either `needle3.cact` or
> `neuralOS.engine`. This is NOT a Windows-only alias: the same two
> spellings work on macOS and Linux engine bundles too. Same runtime, both
> spellings work on every platform. The manual shows
> `needle.exe` / `needle3.cact`; substitute freely:
>
> ```powershell
> .\windows-x86_64\needle.exe --model needle3.cact ...
> .\windows-x86_64\neural.exe  --model neuralOS.engine ...
> ```

## 1. Getting the bundle onto a Python-less box

The bundle is three files: copy the whole `windows-x86_64\` folder from a
workstation (preferred — the fetch machinery itself is Python):

```
windows-x86_64\
  needle.exe            (or neural.exe)
  needle3.cact          (or neuralOS.engine)
  libneedle.a
  needle.h
```

Copy weights beside the binary if you built them elsewhere. No installer,
no registry, no compiler. (Windows Defender/SmartScreen may flag the
unsigned binary on first run — one-time allow, see `engine-binary.md` §6.)

## 2. One-shot selection from PowerShell

```powershell
# Select: the engine names the tool and fills arguments. It never executes.
$out = .\windows-x86_64\needle.exe --model needle3.cact `
        --tools needle_menu.json `
        --prompt "how many ec2 instances do I have"

$call = $out | ConvertFrom-Json
$call.function_calls[0].name                    # -> aws_instances
$call.function_calls[0].arguments               # -> @{ state = "running" }
$call.validation.ungrounded                     # grounding flags, if any
$call.confidence, $call.peak_ram_mb             # selection confidence, footprint
```

Notes that matter in PowerShell specifically:

- The engine output is ONE JSON object on stdout — pipe through
  `ConvertFrom-Json` and read `function_calls`.
- **`--serve` body trap**: the HTTP body parser is whitespace-sensitive.
  PowerShell's default `ConvertTo-Json` puts a space after every colon,
  which silently mis-parses and the model hallucinates calls. Always:

  ```powershell
  $body = @{ input = "aws overview" } | ConvertTo-Json -Compress
  Invoke-RestMethod -Uri "http://127.0.0.1:8080/complete" `
      -Method Post -Body $body -ContentType "application/json"
  ```

- `--system system.txt` still works for session facts; write it with
  `Set-Content` (UTF-8).

## 3. The PowerShell executor loop

The engine selects; PowerShell executes and can feed results back as a new
prompt (there is no built-in loop in `--prompt` mode):

```powershell
function Invoke-NeuralTurn {
    param([string]$Prompt, [string]$Menu = "needle_menu.json")
    $raw  = .\windows-x86_64\neural.exe --model neuralOS.engine --tools $Menu --prompt $Prompt
    $resp = $raw | ConvertFrom-Json
    if (-not $resp.function_calls) { return $resp.reasoning }   # refusal = honest
    foreach ($c in $resp.function_calls) {
        $result = & ("Invoke-" + $c.name) @($c.arguments)      # bridge.ps1 functions
        return $result                                           # capped digest
    }
}
```

- Bridge functions in `bridge.ps1` carry the same name as the menu probes
  (`Invoke-aws_status`, `Invoke-aws_instances`, ...) — selection maps 1:1
  to execution.
- `--tool-index` works the same: pass `--tool-index .tool_index.json` to
  reuse tool embeddings when schemas are unchanged.
- For scheduled runs (Task Scheduler instead of launchd/systemd): wrap the
  same one-shot in a `Register-ScheduledTask` action; stdout is the JSON.

## 4. Server mode as a Windows service

```powershell
# localhost only unless you front it with auth — selection is unauthenticated
Start-Process -WindowStyle Hidden .\windows-x86_64\needle.exe `
    -ArgumentList '--model needle3.cact --tools needle_menu.json --serve --port 8080'

# NSSM / sc.exe embed it as a service if it must survive reboots
sc.exe create NeuralOS binPath= "C:\neuralos\windows-x86_64\needle.exe --model needle3.cact --tools C:\neuralos\needle_menu.json --serve --port 8080"
```

Anyone who can reach the port can drive tool **selection** (execution stays
in your PowerShell) — keep it on localhost or behind your own auth.

## 5. Verification from PowerShell

```powershell
# selection assertion (deterministic engine — greedy decode)
$resp = .\windows-x86_64\needle.exe --model needle3.cact --tools needle_menu.json `
            --prompt "aws overview" | ConvertFrom-Json
if ($resp.function_calls[0].name -ne "aws_status") { throw "selection FAIL" }

# truth check against the native client is the oracle
$direct = aws sts get-caller-identity --output json | ConvertFrom-Json
```

Same gates as everywhere else: coverage >=95%, three phrasings per intent,
one relayed number == one direct query, recorded in `verification.txt`.

## 6. Companion note

This page covers RUNNING the engine. The instance-building variant for
Python-less Windows (PowerShell bridges, generated validators, Phase-4 in
PowerShell) lives in the `neuralos` skill: its
`references/windows-powershell.md`.