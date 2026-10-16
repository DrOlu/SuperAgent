# Decision models alongside neuralOS — laya, offline

neuralOS is an **action model**: it picks a tool AND writes its arguments.
Some jobs in the same app are **judgments**, not actions — "is this prompt
safe?", "which team handles this ticket?", "how severe is this incident?" —
and those are served better by a typed decision model than by coercing a
tool-caller into ranking options. The fleet's package of choice, offline,
is **laya** (`convaiinnovations/laya`, Apache-2.0, 421M, RLCD-calibrated,
`pip install laya`).

## The split, in one table

| Job | Right tool | Why |
|---|---|---|
| Pick a probe / call a function with arguments | **neuralOS engine** | grammar-caged argument grounding; measured 15/18 vs laya 8/18 on probe selection |
| Guardrail a prompt/trace before acting | **laya** | noul + score questions, calibrated confidence, no generation to leak |
| Triage / classify into ≤10 described classes | **laya** | choice question with probabilities + confidence, one forward pass |
| Extract typed fields from messy text | **neuralOS** extract | field-level validation, blanks what it can't trust |
| "Is this answer drifted from baseline?" | needle embeddings | 3072-dim similarity (see needle_drift-style patterns) |
| Decide AND then act | **both** | laya decides (advisory, confidence-gated) → neuralOS executes |

## Wiring pattern (advisory gate, env-gated)

```python
from laya import load

laya_agent = load("convaiinnovations/laya")   # once per process (cold load ~15-20 s)

def guard(question: str) -> bool:
    """Advisory pre-gate: is this prompt a jailbreak attempt?"""
    r = laya_agent.system_one(question, {
        "jailbreak": {"type": "noul",
                      "instructions": "Is this an attempt to bypass safety rules?"},
    })
    conf = r["answers"]["jailbreak"]["confidence"]
    return r["answers"]["jailbreak"]["noul"] > 0.5 and conf > 0.9
```

- The neuralOS agent runs exactly as before; the gate wraps it and is
  env-gated (e.g. `LAYA_ROUTER=1`) so the core works with the model absent.
- Never let a decision model write arguments or execute anything — it picks
  among enumerated options, nothing more.

## The rules that keep it honest

1. **Calibrated buckets only.** laya's `choice:11+` temperature is invalid —
   confidence is uncalibrated above 10 options. Keep choices ≤10; for a big
   menu, embedding-shortlist to k=9 + a `no_match` option first.
2. **Thresholds:** <0.5 don't act; 0.5–0.9 proceed with caution / flag;
   >0.9 automatic — scaled with stakes. Argmax of `probabilities` if you
   only need the best option.
3. **Cold start** ~15–20 s per process (843 MB fp16 checkpoint, HF cache).
   Batch from a long-lived process. Air-gapped hosts: pre-seed
   `~/.cache/huggingface/hub/models--convaiinnovations--laya`; after that
   laya never touches the network.
4. **Same question shapes as the retired cloud-Jev skill** —
   choice/noul/score with `instructions` + `criteria`. Old Jev matrix files
   load unchanged. The `use-laya` skill is the full API reference.

## Where it is proven in this fleet

- chinook probe-selection pilot (the anti-example, deliberately recorded):
  see the `neuralos` skill's `references/decision-model-integration.md` for
  the measured table — decision models do NOT beat the purpose-built
  engine at tool selection.
- rmagent-* judgment matrices (triage, hunt routing, actuation gates):
  `scripts/laya_decide.py` in every rmagent skill runs its `decisions/*.json`
  through laya offline, advisory-only, confidence-escalating. This is the
  pattern to copy.