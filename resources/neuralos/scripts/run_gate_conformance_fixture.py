#!/usr/bin/env python3
"""Sit the GATE_VERSION 1 conformance exam against THIS repo's generator.

Materialises a real instance from the bundled ASK_PY template (the exact
code the `neuralos_factory` tool ships to users), wires a stub bridge and a
stub needle module (no engine, no network), then runs the black-box
conformance suite (gate_conformance.py) over the matrix derived from the
instance's own menu. Exit 0 = the generated Python gate satisfies the
contract; anything else names the failing cases.

This is the exam CI sits (sync-and-release.yml / rebrand.yml) — the
SuperAgent TypeScript gate is examined separately by the vitest suite;
together they pin the two implementations shipped here. The canonical
runner lives in DrOlu/agent-skills skills/neuralos/scripts/.

Standard library only.
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import gen_needle_instance as gen  # noqa: E402
import gate_conformance as gc  # noqa: E402

STUB_BRIDGE = (
    "def count_rows():\n"
    "    return {'rows': 5}\n"
    "\n"
    "\n"
    "def page_reader(n=1):\n"
    "    return {'page': int(n), 'text': 'page %s text' % n}\n"
)

STUB_INSTANCE = """import sys, types

fake = types.ModuleType("needle")


class Needle:
    def __init__(self, tools=None, system=None, auto_date=False):
        self.tools = tools or []

    def run(self, q, max_steps=1):
        name = self.tools[0].__name__ if self.tools else "none"
        return {"results": [{"_tool": name, "via": "model"}], "confidence": 0.5}


fake.Needle = Needle
fake.tool = lambda **kw: (lambda f: f)
sys.modules["needle"] = fake
import needle  # noqa: E402,F401  binds the module for the model fallback

import bridge  # noqa: E402


def count_rows():
    return bridge.count_rows()


def get_page(n=1):
    return bridge.page_reader(int(n))


TOOLS = [count_rows, get_page]
"""

# The menu exercises every cage family: a polluted enum (data containing an
# action verb must NOT teach the gate the verb) and a pattern-caged integer.
MENU = [
    {
        "name": "count_rows",
        "description": "Count the rows in the dataset.",
        "triggers": ["count rows", "how many rows", "row count"],
        "parameters": {
            "type": "object",
            "properties": {"dataset": {"type": "string",
                                       "enum": ["do-not-delete-archive", "ledger"]}},
            "required": []
        }
    },
    {
        "name": "get_page",
        "description": "Read one page of the report by number.",
        "triggers": ["show page", "page content", "read page"],
        "parameters": {
            "type": "object",
            "properties": {"n": {"type": "integer", "pattern": "page\\s+(\\d{1,3})",
                                 "minimum": 1}},
            "required": ["n"]
        }
    }
]


def materialise_instance(root):
    os.makedirs(root, exist_ok=True)
    with open(os.path.join(root, "ask.py"), "w", encoding="utf-8") as fh:
        fh.write(gen.ASK_PY)  # Python must emit it — the escapes are its own
    with open(os.path.join(root, "needle_menu.json"), "w", encoding="utf-8") as fh:
        json.dump(MENU, fh, indent=1)
    with open(os.path.join(root, "bridge.py"), "w", encoding="utf-8") as fh:
        fh.write(STUB_BRIDGE)
    with open(os.path.join(root, "instance.py"), "w", encoding="utf-8") as fh:
        fh.write(STUB_INSTANCE)
    return root


def main():
    tmp = tempfile.mkdtemp(prefix="gate-exam-")
    instance = materialise_instance(os.path.join(tmp, "instance"))
    print("sitting the conformance exam on the generated ask.py "
          f"(GATE_VERSION={gc.GATE_VERSION}) ...")
    return gc.main(["--instance", instance, "--python", sys.executable,
                    "--verbose"])


if __name__ == "__main__":
    sys.exit(main())
