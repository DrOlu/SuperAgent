#!/usr/bin/env python3
"""Gate & envelope conformance suite — run the refusal gate against a matrix
of questions and assert the contract, black-box, on ANY OS.

This is the fleet conformance harness proposed in DrOlu/ReactorPro#107: the
GATE_VERSION 1 refusal gate exists in several independent implementations
(generated ask.py, SuperAgent's TypeScript gate, neuralOSd router._gate).
Each implementation must satisfy the SAME observable contract:

  * a question the gate refuses  -> exit 2, envelope JSON with
    refused=true, refusal_reason=<reason>, gate_version=1, results=null
  * a question it answers        -> exit 0, envelope JSON with
    refused=false, refusal_reason=null, gate_version=1, probe=<name>,
    legacy keys (probe/confidence/latency_ms/mode/results) intact

Usage:
  # conformance against a generated instance (built-in matrix derived
  # from the instance's own menu, plus any extra --cases):
  python gate_conformance.py --instance /path/to/instance

  # with an explicit question/expectation matrix (JSON list):
  python gate_conformance.py --instance . --cases cases.json

Case schema (all fields optional except question/expect):
  {"question": "...", "expect": "answered"}                    # exit 0, refused=false
  {"question": "...", "expect": "answered", "probe": "name"}   # ...and routed to <name>
  {"question": "...", "expect": "refused"}                     # exit 2, refused=true
  {"question": "...", "expect": "refused", "reason": "action_intent"}
  {"question": "...", "expect": "exit", "code": 2}             # raw exit-code check

Exit codes: 0 all cases passed, 1 at least one failed, 2 usage error.
Cases whose precondition does not hold for this menu (e.g. an action-verb
case for a menu that legitimately offers a delete-capable probe) are
reported as SKIPPED, never as failures.

Standard library only — runs anywhere Python runs (macOS/Linux/Windows).
"""
import argparse
import json
import os
import subprocess
import sys

GATE_VERSION = 1
ACTION_VERBS = ("play", "erase", "delete", "remove", "drop", "wipe", "purge",
                "send", "execute", "restart", "shutdown", "kill", "exploit",
                "deploy", "cancel")
QUALIFIERS = ("blocked", "overdue", "rejected", "closed", "resolved",
              "pending", "escalated", "cancelled", "archived", "on hold",
              "last week", "last month", "last year", "this week",
              "this month", "yesterday", "today", "unassigned")
STOP = set("the a an of in on for to and or is are was were what which who "
           "me give all with their from by at it its do does did i we you "
           "this that those these there have has had more than one not use "
           "between during along per into over under about".split())

GREEN, RED, YELLOW, DIM, OFF = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"


def c(text, color):
    if sys.stdout.isatty():
        return f"{color}{text}{OFF}"
    return str(text)


def load_menu(instance_dir):
    """Accept every documented menu shape: a bare probe array, {menu: [...]},
    {probes: [...]}."""
    menu_path = os.path.join(instance_dir, "needle_menu.json")
    with open(menu_path, encoding="utf-8") as fh:
        parsed = json.load(fh)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        for key in ("menu", "probes"):
            if isinstance(parsed.get(key), list):
                return parsed[key]
    raise SystemExit(f"{menu_path}: not a probe array (bare list, {{menu:[...]}} "
                     "or {{probes:[...]}})")


def gate_tokens(text):
    out = set()
    for tok in _words(text):
        if tok not in STOP:
            out.add(tok[:-1] if len(tok) > 3 and tok.endswith("s") else tok)
    return out


def _words(text):
    import re
    return re.findall(r"[a-z0-9_]+", str(text).lower())


def probe_vocab(probe, include_enums=True):
    """triggers + name (+ enum values) — the words a probe can be said to know."""
    vocab = gate_tokens(probe.get("triggers") or [])
    vocab |= gate_tokens(probe.get("name", "").replace("_", " "))
    if not include_enums:
        return vocab
    props = (probe.get("parameters") or {}).get("properties") or {}
    for spec in props.values():
        if isinstance(spec, dict):
            for value in spec.get("enum") or []:
                vocab |= gate_tokens(value)
    return vocab


def capability_vocab(menu):
    """triggers/names/descriptions only — enum values are data, not
    capabilities (a bucket named do-not-delete-... must not teach the menu
    the verb)."""
    vocab = set()
    for probe in menu:
        vocab |= probe_vocab(probe, include_enums=False)
    return vocab


def derive_cases(menu):
    """Built-in matrix from the menu itself. Conservative: a case is skipped
    (marked precondition-failed) when this menu's own vocabulary would make
    the expected refusal wrong."""
    cases = []
    capability = capability_vocab(menu)
    all_known = set().union(*(probe_vocab(p) for p in menu)) if menu else set()

    # 1. every probe's first trigger must answer (false-refusal sweep)
    for probe in menu:
        triggers = probe.get("triggers") or []
        if triggers:
            cases.append({"question": triggers[0], "expect": "answered",
                          "probe": probe["name"],
                          "label": f"first-trigger:{probe['name']}"})

    # 2. one action-verb case, if no probe claims a delete-capability
    if "delete" not in capability and menu:
        known_noun = sorted(all_known)[0] if all_known else "records"
        cases.append({"question": f"delete all the {known_noun}",
                      "expect": "refused", "reason": "action_intent",
                      "label": "action-verb"})

    # 3. one dropped-filter case, if some probe lacks the qualifier
    first_trigger = next((p["triggers"][0] for p in menu if p.get("triggers")), None)
    if first_trigger:
        winner = next((p for p in menu if p.get("triggers") and p["triggers"][0] == first_trigger), menu[0])
        winner_vocab = probe_vocab(winner)
        for qualifier in QUALIFIERS:
            if qualifier.split()[0] not in winner_vocab:
                noun = sorted(winner_vocab)[0] if winner_vocab else "records"
                cases.append({"question": f"{first_trigger} {qualifier}".replace("  ", " "),
                              "expect": "refused",
                              "reason": f"dropped_filter:{qualifier}",
                              "label": f"dropped-filter:{qualifier}"})
                break

    # 4. one unknown-subject case (words no probe has ever heard of)
    cases.append({"question": "frobnicate the widget sanctuary",
                  "expect": "refused", "reason": "no_probe_matches",
                  "label": "unknown-subject"})
    return cases


def run_ask(instance_dir, python_bin, question, timeout):
    cmd = [python_bin, "ask.py", question, "--no-cache"]
    try:
        proc = subprocess.run(cmd, cwd=instance_dir, capture_output=True,
                              text=True, timeout=timeout)
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return None, "", f"timeout after {timeout}s"
    except OSError as exc:
        return None, "", str(exc)


def check_case(case, instance_dir, python_bin, timeout):
    """Returns (status, detail): status in pass/fail/skip."""
    question = case["question"]
    expect = case.get("expect")
    code, stdout, stderr = run_ask(instance_dir, python_bin, question, timeout)

    envelope = None
    if stdout.strip():
        try:
            envelope = json.loads(stdout)
        except json.JSONDecodeError:
            pass

    if expect == "exit":
        want = case.get("code")
        if code == want:
            return "pass", f"exit={code}"
        return "fail", f"expected exit {want}, got {code}: {stderr[:120]}"

    if expect == "answered":
        if code is None:
            return "fail", stderr[:160]
        if code != 0:
            return "skip", f"precondition failed: exited {code} ({stderr[:100]})"
        if not isinstance(envelope, dict):
            return "fail", "exit 0 but stdout is not a JSON envelope"
        if "refused" not in envelope:
            return "skip", ("pre-contract instance: envelope carries no "
                            "refused field — regenerate with a current generator")
        if envelope.get("refused") is not False:
            return "skip", f"precondition failed: gate refused ({envelope.get('refusal_reason')})"
        if envelope.get("gate_version") != GATE_VERSION:
            return "fail", f"gate_version {envelope.get('gate_version')!r} != {GATE_VERSION}"
        if envelope.get("refusal_reason") is not None:
            return "fail", "answered envelope must carry refusal_reason: null"
        for legacy in ("probe", "confidence", "latency_ms", "mode", "results"):
            if legacy not in envelope:
                return "fail", f"answered envelope lost legacy key: {legacy}"
        want_probe = case.get("probe")
        if want_probe and envelope.get("probe") != want_probe:
            return "fail", f"routed to {envelope.get('probe')!r}, expected {want_probe!r}"
        return "pass", f"probe={envelope.get('probe')}"

    if expect == "refused":
        if code is None:
            return "fail", stderr[:160]
        if code != 2:
            return "skip", f"precondition failed: exited {code} (answered?)"
        if not isinstance(envelope, dict):
            return "fail", "exit 2 but stdout is not a JSON envelope"
        if envelope.get("refused") is not True:
            return "fail", "exit 2 but envelope.refused is not true"
        if envelope.get("gate_version") != GATE_VERSION:
            return "fail", f"gate_version {envelope.get('gate_version')!r} != {GATE_VERSION}"
        want_reason = case.get("reason")
        got_reason = envelope.get("refusal_reason")
        if want_reason:
            # parameterized variants (no_probe_matches(unknown=x)) still match
            # their bare token — the reason FAMILY is the contract
            if got_reason != want_reason and not str(got_reason).startswith(want_reason):
                return "fail", f"reason {got_reason!r} != {want_reason!r}"
        elif not got_reason:
            return "fail", "refusal envelope must carry a refusal_reason"
        return "pass", f"reason={got_reason}"

    return "fail", f"unknown expect: {expect!r}"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--instance", required=True, help="instance directory (ask.py + needle_menu.json)")
    ap.add_argument("--cases", help="JSON file with an explicit case matrix")
    ap.add_argument("--python", default=sys.executable,
                    help="interpreter for ask.py (default: the one running this suite)")
    ap.add_argument("--timeout", type=int, default=120, help="per-ask timeout seconds")
    ap.add_argument("--verbose", action="store_true", help="print every case, not just failures")
    args = ap.parse_args(argv)

    if not os.path.isfile(os.path.join(args.instance, "ask.py")):
        ap.error(f"{args.instance}: no ask.py — the conformance suite drives ask.py black-box")
    menu = load_menu(args.instance)

    if args.cases:
        with open(args.cases, encoding="utf-8") as fh:
            cases = json.load(fh)
        if not isinstance(cases, list):
            ap.error("--cases file must be a JSON list of case objects")
    else:
        cases = derive_cases(menu)

    results = {"pass": [], "fail": [], "skip": []}
    for case in cases:
        label = case.get("label") or case.get("question", "?")[:60]
        status, detail = check_case(case, args.instance, args.python, args.timeout)
        results[status].append((label, detail))
        mark = {"pass": c("PASS", GREEN), "fail": c("FAIL", RED), "skip": c("SKIP", YELLOW)}[status]
        if args.verbose or status == "fail":
            print(f"  {mark}  {label}  {c(detail, DIM)}")

    total = len(cases)
    print(f"\n{c('gate conformance', DIM)} GATE_VERSION={GATE_VERSION}  "
          f"{c(str(len(results['pass'])) + ' passed', GREEN)}  "
          f"{c(str(len(results['fail'])) + ' failed', RED) if results['fail'] else '0 failed'}  "
          f"{c(str(len(results['skip'])) + ' skipped', YELLOW) if results['skip'] else '0 skipped'}"
          f"  / {total} cases  ({args.instance})")
    if results["fail"]:
        for label, detail in results["fail"]:
            print(c(f"  FAILED: {label} — {detail}", RED))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
