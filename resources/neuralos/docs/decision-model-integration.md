# Decision-model integration (optional seam) — laya, offline

This is an OPTIONAL side channel for neuralOS instances. The neuralOS
engine (121M, grammar-caged, tool-trained) remains the **mandatory core and
the default selector**. Nothing here replaces it. Read this once before
wiring any decision model into an instance.

## The category distinction (why this seam exists at all)

| | neuralOS engine (needle) | laya (convaiinnovations/laya) |
|---|---|---|
| Class | **action model** — picks a tool AND writes its arguments | **decision model** — picks among listed options only |
| Output | function call with typed arguments | choice/noul/score + probabilities + calibrated confidence |
| Training target | tool menus, argument grounding | typed judgments (JevBench-class) |
| Refusal mode | empty call list | `no_match` option + low confidence |
| Cost | offline, ~100 MB RAM, ~35 MB weights | offline, 843 MB fp16 checkpoint, ~15-20 s cold load |
| Best at | "run the probe that answers this" | "which of ≤10 well-described classes is this?" |

A decision model **cannot write arguments** — it can only choose among
options you enumerate. That is the whole boundary: judgments to laya,
actions to the engine.

## Measured verdict — do not skip this table

Chinook pilot (2026-09-23, 37-probe menu, 18 corrected cases):

| Arm | Score | Latency/case |
|---|---|---|
| **needle engine, full menu in context** | **15/18** | ~9.5 s |
| laya, needle-embedding shortlist k=9 | 8/18 | ~0.9 s |
| laya, laya-embedding shortlist | 5/18 | ~0.6 s |
| cloud Jev (OpenRouter, for reference) | 14/18 | ~1.1 s, $0.000016/call |
| hybrid (laya decides, conf<0.7 → needle) | 15/18 — but escalates 17/18 | laya + needle |

Findings, all load-bearing:

1. **Probe selection over a fine-trigger-word menu is NOT a
   laya-shaped task.** The 121M purpose-built engine beats the 421M
   decision model outright (15 vs 8). The cloud-Jev advantage does not
   survive localisation (14 → 8).
2. **Laya's calibration is honest.** Its confidences sat below 0.7 on
   almost every probe-selection question (its single ≥0.7 pick was
   correct) — it *knows* this is not its task. As a router that means
   the hybrid degenerates to the engine plus added latency.
3. **Menu design is the dominant term.** Fixing sibling confusion in the
   menu moved the engine +3 cases (12→15); swapping the decision head
   moved it −7.
4. **Decision models DO earn their keep on decision-shaped jobs** —
   guardrails, triage, classify-into-≤10-classes, severity scoring. The
   rmagent-* fleet runs its judgment matrices through laya exactly this
   way (`scripts/laya_decide.py`, advisory, confidence-gated).

## Rules for wiring it in

1. **Env-gate it.** The instance must work perfectly with the variable
   unset (`LAYA_ROUTER=1` to enable). Never a mandatory hop.
2. **Advisory only.** A laya verdict gates, flags, or escalates — it never
   executes, never rewrites a call, never replaces an engine pick
   silently.
3. **Confidence thresholds** (from the use-laya skill): <0.5 don't act;
   0.5–0.9 proceed with caution / flag; >0.9 act automatically — and only
   in **calibrated buckets** (next rule).
4. **Keep choices to ≤10 options.** The checkpoint ships an invalid
   temperature for `choice:11+`; confidence there is uncalibrated and must
   not be thresholded. Shortlist high-cardinality choices to k=9 plus an
   explicit `no_match` (that is what `scripts/laya_router.py` defaults to).
5. **Shortlist with a real embedder when the option set is large.** Laya's
   own encoder mean-pool is a decision encoder, not a bi-encoder — in the
   pilot it dropped the correct option on 12/18 questions. neuralOS's own
   embeddings (`needle.Needle().embed`) retrieve measurably better.
6. **Cold start is real.** Each fresh process loads the 843 MB checkpoint
   (~15–20 s). Batch from a long-lived process; do not shell out per
   question on a hot path.
7. **Air-gapped hosts:** pre-seed
   `~/.cache/huggingface/hub/models--convaiinnovations--laya` — after that
   no network is needed, ever.
8. **Hosts where Python is never permitted at runtime** (Windows/
   PowerShell-only estates): laya cannot live on the box — it needs Python
   + torch at call time, unlike the self-contained neuralOS engine binary.
   Run laya's judgments on the jump host / orchestrator and ship the
   (advisory) verdicts; the deployed instance stays needle-only. Full
   cold-start runbook (both caches, smoke tests, platform notes):
   the `neuralos-skill`'s `references/new-host-bootstrap.md`.

## The router script

`scripts/laya_router.py` is the pilot router, generalized and unit-tested:

```bash
python scripts/laya_router.py --menu <instance>/needle_menu.json \
    --question "how many invoices are there" --embed needle
# -> pick / confidence / escalate flag / shortlist, JSON with --json
```

- builds compact criteria from the menu (first sentence, 10-word cap,
  trigger hint), adds `no_match`, shortlists k=9 via needle embeddings,
  one `system_one` call, returns the pick with confidence and the
  escalate flag (`--threshold`, default 0.7).
- import-safe without laya installed; the live path raises a guided
  ImportError. Pure functions (`compact_criterion`, `build_criteria`,
  `uncalibrated`, `escalates`) are unit-tested in
  `tests/test_laya_router.py` and run in CI without torch.

## Cold-start install (brand-new machine)

```bash
pip install laya              # pulls torch if absent; CPU/mps/cuda auto
# first call downloads the checkpoint (~843 MB) into the HF cache:
python -c "from laya import load; load('convaiinnovations/laya')"
```

After the first download everything is offline. `HF_HUB_ENABLE_HF_TRANSFER=1`
(with `pip install hf_transfer`) parallelizes a throttled CDN.

See the `use-laya` skill for the full question-shape reference
(choice/noul/score, state guidance, troubleshooting). Question and matrix
files written for the retired cloud-Jev (use-jev) skill load unchanged.