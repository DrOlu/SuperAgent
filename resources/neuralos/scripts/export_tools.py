#!/usr/bin/env python3
"""Export @needle.tool schemas from a Python module to tools.json.

Produces the JSON array the standalone engine binary (--tools) and
`needle run --tools` consume, straight from the decorated functions — so the
Python API and the engine always share one source of truth.

Usage:
    python export_tools.py my_tools_module.py                    # all tools
    python export_tools.py my_tools_module.py tool_a tool_b       # subset
    python export_tools.py my_tools_module.py -o tools.json

Notes:
  - The module is imported, so its top-level code runs. Keep tool modules
    import-safe (no side effects beyond defining functions/constants).
  - Tools are discovered via the `_needle_tool` schema the decorator
    attaches, so triggers, Field constraints and Args: descriptions are all
    carried over.
"""

import argparse
import importlib.util
import json
import os
import sys


def load_module(path: str):
    path = os.path.abspath(path)
    if not os.path.isfile(path):
        raise SystemExit(f"no such file: {path}")
    spec = importlib.util.spec_from_file_location(
        "_export_tools_target", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        raise SystemExit(f"importing {path} failed: {exc}\n"
                         "(tool modules must be import-safe — no side "
                         "effects at top level)")
    return module


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("module", help="path to a .py file with @needle.tool functions")
    parser.add_argument("tools", nargs="*",
                        help="optional tool/function names to include (default: all)")
    parser.add_argument("-o", "--out", default="tools.json",
                        help="output path (default: ./tools.json)")
    args = parser.parse_args()

    try:
        import needle  # noqa: F401 — fail early with a clear message
    except ImportError:
        raise SystemExit("cactus-needle is not installed for this Python "
                         f"({sys.executable}); pip install cactus-needle")

    module = load_module(args.module)
    found = {name: getattr(module, name)._needle_tool
             for name in dir(module)
             if callable(getattr(module, name, None))
             and hasattr(getattr(module, name), "_needle_tool")}

    if not found:
        raise SystemExit(f"no @needle.tool functions found in {args.module}")

    if args.tools:
        missing = [t for t in args.tools if t not in found]
        if missing:
            raise SystemExit(f"not tool functions in module: {missing}\n"
                             f"available: {sorted(found)}")
        selected = {t: found[t] for t in args.tools}
    else:
        selected = found

    schemas = list(selected.values())
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(schemas, handle, indent=2, ensure_ascii=False)
    print(f"wrote {args.out}: {[s['name'] for s in schemas]}")


if __name__ == "__main__":
    main()
