#!/usr/bin/env python3
"""SuperAgent brand sweep — rewrites user-visible i18n VALUES after a sync.

The upstream-sync pipeline replaces the whole tree with fresh SuperAgent
and runs rebrand.py, whose token list is code-safe but misses locale VALUES
(hyphenated forms, bare "Cherry", "CherryIN", "CherryAI", "Cherry Cloud").
This script sweeps ONLY the values of every locale pack; i18n KEYS are
never modified (keys like agent.tools.builtin.CherryConfig.label are
internal identifiers referenced from code).

Run after rebrand.py:  python3 scripts/superagent-brand-sweep.py <repo-root>
Idempotent; exits non-zero if any value still matches /cherry/i after the
sweep (so CI catches new upstream strings instead of shipping them).
"""
import json
import re
import sys
from pathlib import Path

# Ordered, longest-first. Values only — never keys.
REPLACEMENTS = [
    ("Cherry-Studio-Berater", "SuperAgent-Berater"),
    ("Cherry Support", "SuperAgent Support"),
    ("Cherry Cloud", "SuperAgent Cloud"),
    ("CherryIN Models", "SuperAgent Models"),
    ("CherryIN", "SuperAgent"),
    ("CherryAI", "SuperAgent"),
    ("CHERRY_GITHUB_TOKEN", "SUPERAGENT_GITHUB_TOKEN"),
    ("Cherry account", "SuperAgent account"),
    ("Cherry could not", "SuperAgent could not"),
    ("Cherry will clean up", "SuperAgent will clean up"),
    ("Cherry-specific", "SuperAgent-specific"),
    ("SuperAgent Assistant", "SuperAgent Assistant"),
    ("SuperAgent", "SuperAgent"),
    ("Cherry", "SuperAgent"),  # bare, LAST
]

CJK_RE = re.compile(r"[\u3000-\u30ff\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]")


def sweep_file(path: Path) -> int:
    d = json.loads(path.read_text())
    changed = 0
    for key, value in d.items():
        if not isinstance(value, str) or "cherry" not in value.lower():
            continue
        new = value
        for old, repl in REPLACEMENTS:
            new = new.replace(old, repl)
        if new != value:
            d[key] = new
            changed += 1
    if changed:
        path.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    return changed


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    total = 0
    for pattern in ("src/renderer/i18n/locales/*.json", "src/main/i18n/locales/*.json"):
        for path in sorted(root.glob(pattern)):
            total += sweep_file(path)

    # Verify: no locale VALUE may still mention Cherry. Keys are exempt
    # (internal identifiers). en-us additionally must carry no CJK.
    offenders: list[str] = []
    for pattern in ("src/renderer/i18n/locales/*.json", "src/main/i18n/locales/*.json"):
        for path in sorted(root.glob(pattern)):
            d = json.loads(path.read_text())
            for key, value in d.items():
                if isinstance(value, str) and "cherry" in value.lower():
                    offenders.append(f"{path.relative_to(root)} {key}")
                if path.name == "en-us.json" and CJK_RE.search(value or ""):
                    offenders.append(f"{path.relative_to(root)} {key} (CJK)")

    if offenders:
        for line in offenders:
            print(f"[brand-sweep] FAIL {line}", file=sys.stderr)
        return 1
    print(f"[brand-sweep] swept {total} values; all locales clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
