#!/usr/bin/env python3
"""laya_router.py — OPTIONAL decision-model side channel for neuralOS instances.

Given an instance's exported menu (needle_menu.json) and a question, this
script asks the LOCAL laya decision model (convaiinnovations/laya, offline,
Apache-2.0) which probe answers it, with calibrated confidence. It never
executes anything — it returns a pick plus a confidence, for the caller to
gate on.

STATUS — measured, do not invert this (chinook 37-probe pilot, 2026-09-23):
    needle engine (full menu in context)  15/18
    laya, needle-embed shortlist (k=9)      8/18
    laya, laya-embed shortlist              5/18
    hybrid (laya decides, conf<0.7->needle) degenerates to needle + latency
  Probe selection on a fine-trigger-word menu is NOT a laya-shaped task.
  The neuralOS engine remains the mandatory selector. Use this router only
  for decision-shaped side jobs (guardrails, triage, doc classification over
  <=10 well-described classes) — env-gate it (LAYA_ROUTER=1), never make it
  the default path. See references/decision-model-integration.md.

CALIBRATION: choice questions with 11+ options run in laya's UNCALIBRATED
bucket — the default shortlist k=9 plus the auto-added no_match keeps the
head at 10 options (the calibrated choice:6-10 bucket). Do not raise --k
above 9 without accepting uncalibrated confidence.

Usage:
  python laya_router.py --menu needle_menu.json --question "how many invoices"
  python laya_router.py --menu needle_menu.json --question "..." \\
      --criteria-file criteria.json --embed needle --threshold 0.7 --json

Requires: pip install laya (one-time 843 MB checkpoint download; offline
afterwards). needle embeddings (--embed needle, the default) additionally
require the cactus-needle package; --embed laya needs nothing beyond laya.
Cold start: each invocation loads the checkpoint (~15-20 s) — batch calls
from a long-lived process instead of shelling out per question.
"""
import argparse, json, os, re, sys

DEFAULT_K = 9                # + no_match = 10 options -> calibrated bucket
CALIBRATED_MAX_OPTIONS = 10
DEFAULT_THRESHOLD = 0.7      # below this, escalate to the engine / operator


# ---------------------------------------------------------------- pure layer

def compact_criterion(description: str, triggers, max_words: int = 10) -> str:
    """First sentence of a probe description, capped, with a first trigger
    hint, never leaving a dangling half-parenthetical (a pilot-tested bug:
    naive word-capping cut inside '(e.g. ...' and produced '(e.g. (e.g. …')."""
    first = re.split(r"(?<=[.!?])\s", (description or "").strip())[0]
    first = re.sub(r"\s+", " ", first).strip()
    words = first.split()
    if len(words) > max_words:
        first = " ".join(words[:max_words]).rstrip()
        first = re.sub(r"\s*\([^)]*$", "", first).rstrip()  # dangling '(' tail
        if first and not first.endswith((".", ")")):
            first += "."
    trig = list(triggers or [])
    if trig and "(e.g." not in first:
        first = f"{first} (e.g. {trig[0]})"
    return first


def build_criteria(menu, max_words: int = 10) -> dict:
    """{probe_name: compact criterion} from an exported menu list."""
    return {t["name"]: compact_criterion(t.get("description", ""),
                                        t.get("triggers"), max_words)
            for t in menu}


def option_count(question_def) -> int:
    crit = question_def.get("criteria") if isinstance(question_def, dict) else None
    return len(crit) if isinstance(crit, (dict, list)) else 0


def uncalibrated(question_def, cap: int = CALIBRATED_MAX_OPTIONS) -> bool:
    """True when a choice question would run in laya's uncalibrated bucket."""
    return (isinstance(question_def, dict)
            and question_def.get("type") == "choice"
            and option_count(question_def) > cap)


def escalates(confidence, threshold: float = DEFAULT_THRESHOLD) -> bool:
    """Confidence below the threshold -> the caller should escalate."""
    return (confidence is None) or (confidence < threshold)


# ---------------------------------------------------------------- live layer

def _embed_needle():
    """On-device embeddings from the neuralOS runtime itself."""
    import needle
    import numpy as np
    nz = needle.Needle()
    def embed_fn(texts):
        return np.array([nz.embed(t) for t in texts], dtype=np.float32)
    return embed_fn


def _embed_laya(agent):
    from laya.shortlist import embed_fn_from_agent
    return embed_fn_from_agent(agent)


def route(menu_path, question, criteria_file=None, k=DEFAULT_K,
          embed="needle", threshold=DEFAULT_THRESHOLD):
    """Run the question through laya over the menu. Returns a dict; raises
    ImportError with guidance when laya (and, for --embed needle, cactus-
    needle) is not installed. Loads the checkpoint per call (cold start)."""
    menu = json.load(open(menu_path))
    if criteria_file:
        criteria = json.load(open(criteria_file))
        if set(criteria) != {t["name"] for t in menu}:
            print("warning: criteria file does not cover the menu exactly",
                  file=sys.stderr)
    else:
        criteria = build_criteria(menu)
    criteria["no_match"] = "none of these probes fits the question at all"

    question_def = {
        "type": "choice",
        "instructions": "Which menu probe answers the user question?",
        "criteria": criteria,
    }
    if uncalibrated(question_def):
        print(f"warning: {option_count(question_def)} options exceed laya's "
              f"calibrated bucket ({CALIBRATED_MAX_OPTIONS}); confidence is "
              f"UNCALIBRATED — lower --k.", file=sys.stderr)

    from laya import load
    from laya.shortlist import predict_shortlist
    agent = load("convaiinnovations/laya")
    embed_fn = _embed_needle() if embed == "needle" else _embed_laya(agent)

    state = (f"User question about this data source: \"{question}\" "
             f"Pick the single best probe to answer it.")
    result = predict_shortlist(agent, state, {"probe": question_def},
                               embed_fn, k=k)
    ans = result["answers"]["probe"]
    short = result.get("shortlist", {}).get("probe", {})
    return {
        "question": question,
        "pick": ans.get("choice"),
        "confidence": ans.get("confidence"),
        "probabilities": ans.get("probabilities"),
        "no_match": ans.get("choice") == "no_match",
        "escalate": escalates(ans.get("confidence"), threshold),
        "threshold": threshold,
        "shortlist": short.get("labels", []),
        "shortlist_scores": short.get("scores"),
        "model": "laya (offline)",
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--menu", required=True, help="exported needle_menu.json")
    ap.add_argument("--question", required=True)
    ap.add_argument("--criteria-file", help="pre-tuned {name: criterion} JSON")
    ap.add_argument("--k", type=int, default=DEFAULT_K,
                    help="shortlist size before no_match (default 9 = calibrated)")
    ap.add_argument("--embed", choices=["needle", "laya"], default="needle",
                    help="shortlist embedder (needle retrieves better)")
    ap.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument("--json", action="store_true", help="JSON result only")
    args = ap.parse_args()

    try:
        out = route(args.menu, args.question, args.criteria_file,
                    args.k, args.embed, args.threshold)
    except ImportError as e:
        print(f"laya_router: missing dependency: {e}\n"
              f"  pip install laya  (one-time 843 MB checkpoint download)\n"
              f"  and for --embed needle: the cactus-needle package",
              file=sys.stderr)
        sys.exit(2)

    if args.json:
        print(json.dumps(out, indent=1))
    else:
        print(f"pick: {out['pick']}  confidence: {out['confidence']}")
        print(f"escalate to engine/operator: "
              f"{'YES' if out['escalate'] else 'no'} "
              f"(threshold {out['threshold']})")
        print(f"shortlist: {', '.join(out['shortlist'][:args.k])}")


if __name__ == "__main__":
    main()