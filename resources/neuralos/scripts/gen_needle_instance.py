#!/usr/bin/env python3
"""Generate a runnable needle instance from a neuralos profile + models.

Reads profile.json and models.py (both produced by this skill's earlier phases)
and writes an instance directory:

  needle_menu.json   the probe menu (name/description/args/triggers), also
                     usable directly by the standalone engine binary
  bridge.py          retrieval + parsing: reads the real source and validates
                     every record through the Pydantic models in models.py
  instance.py        the needle agent (Python runtime): menu wired as tools
                     with triggers, agentic loop, --coverage flag
  verify.py          Phase-4 checks: model coverage + selection test
  README.md          how to run, what to ask, how to extend

Usage:
  python gen_needle_instance.py --profile profile.json --models models.py \
      --out myfeed --db-dsn mysql://user:pw@host/db [--runtime python|engine]
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

ENUM_MAX = 12
ROW_CAP = 25


def snake(name):
    name = re.sub(r"[^0-9a-zA-Z]+", "_", name).strip("_").lower()
    return name or "field"


def pascal(name):
    return "".join(p[:1].upper() + p[1:] for p in re.split(r"[^0-9a-zA-Z]+", name) if p) or "Record"


def enum_fields(fields):
    return [(f["name"], f["enum_values"]) for f in (fields or [])
            if f.get("enum_values") and f.get("distinct", 99) <= ENUM_MAX]


def num_fields(fields):
    return [f["name"] for f in (fields or [])
            if f.get("detected_type") in ("integer", "number")]


def menu_entry(name, description, params, triggers):
    """params: dict key -> property dict, with optional "__optional__": True marker."""
    props, required = {}, []
    for key, spec in params.items():
        spec = dict(spec)
        optional = spec.pop("__optional__", False)
        props[key] = spec
        if not optional:
            required.append(key)
    return {"name": name, "description": description,
            "parameters": {"type": "object", "properties": props, "required": required},
            "triggers": triggers}


# ============================================================ menu building
def build_menu(profile, table, agent_name):
    kind = profile["source"]["kind"]
    menu = []
    S = lambda v, **kw: {"type": "string", "description": v, **kw}

    if kind == "database":
        # one table per instance: a 121M selector degrades beyond ~a dozen probes
        chosen_tables = [x for x in profile["source"].get("tables", [])
                         if not table or x["name"] == table]
        if table and not chosen_tables:
            have = [x["name"] for x in profile["source"].get("tables", [])]
            raise SystemExit(f"table {table!r} not in the profile; profiled tables: {have}")
        for t in chosen_tables:
            tname, tn = t["name"], snake(t["name"])
            menu.append(menu_entry(
                f"{tn}_count", f"Count rows in the {tname} table.", {},
                [f"how many {tn}", f"count all {tn} rows", f"{tn} total", f"{tn} row count"]))
            menu.append(menu_entry(
                f"{tn}_recent", f"Most recent rows from {tname}, newest first.",
                {"limit": {"type": "integer", "description": "how many rows, e.g. 10",
                           "minimum": 1, "maximum": 100, "__optional__": True}},
                [f"recent {tn}", f"latest {tn}", f"show {tn}", f"last {tn} rows"]))
            menu.append(menu_entry(
                f"{tn}_summary", f"Aggregate summary of {tname}: row count plus "
                                 f"count/min/max/average of every numeric column.", {},
                [f"{tn} summary", f"{tn} stats", f"aggregate {tn}", f"{tn} numbers"]))
            for col, values in enum_fields(t["columns"]):
                c = snake(col)
                menu.append(menu_entry(
                    f"{tn}_by_{c}", f"Count and list {tname} rows where {col} matches a "
                                    f"specific value. Values observed in the data: "
                                    f"{', '.join(map(str, values[:6]))}.",
                    {"value": {"type": "string", "description": f"exact value of {col}",
                               "enum": values[:ENUM_MAX]}},
                    [f"count {tn} by {c}", f"count {tn} where {c}", f"count {tn} where {c.replace(chr(95), chr(32))}", f"{tn} by {c}", f"{tn} where {c.replace(chr(95), chr(32))}", f"filter {tn} by {c}"]))
    elif kind == "log_lines":
        levels = sorted({lv for t in profile.get("log_templates", [])
                         for lv in t.get("distinct_values", {}).get("level", [])})
        menu.append(menu_entry(
            "parse_tail", "Parse the newest log lines through the typed templates.",
            {"lines": {"type": "integer", "description": "how many recent lines, e.g. 50",
                       "minimum": 1, "maximum": 2000, "__optional__": True}},
            ["parse tail", "recent lines", "last log lines", "parse logs"]))
        if levels:
            menu.append(menu_entry(
                "count_by_level", "Count log lines per level, or for one specific level.",
                {"level": {"type": "string", "description": "specific level, e.g. ERROR",
                           "enum": levels[:ENUM_MAX], "__optional__": True}},
                ["count by level", "errors in the log", "log level counts",
                 "how many errors"]))
        menu.append(menu_entry(
            "search_log", "Find log lines containing a substring.",
            {"contains": S("text to search for, e.g. an IP or service name")},
            ["search log", "find in log", "grep log", "log contains"]))
    else:  # delimited / json_lines / json_doc
        enums = enum_fields(profile.get("fields", []))
        menu.append(menu_entry(
            "peek", "Fetch the first records, parsed and validated through the model.",
            {"limit": {"type": "integer", "description": "how many records, e.g. 10",
                       "minimum": 1, "maximum": 100, "__optional__": True}},
            ["peek", "first records", "show records", "sample the data"]))
        menu.append(menu_entry(
            "count_records", "Count the records in the source.", {},
            ["how many records", "count records", "record count", "how many rows"]))
        menu.append(menu_entry(
            "summary", "Per-field summary: non-null counts, distinct values, top values "
                       "from a full scan of the source.", {},
            ["summary", "field summary", "data profile", "stats"]))
        for col, values in enums:
            c = snake(col)
            menu.append(menu_entry(
                f"count_by_{c}", f"Count records grouped by {col}, or for one value. "
                                 f"Observed values: {', '.join(map(str, values[:6]))}.",
                {"value": {"type": "string", "description": f"specific {col} value",
                           "enum": values[:ENUM_MAX], "__optional__": True}},
                [f"by {c}", f"group by {c}", f"count by {c}"]))
    # strip internal markers
    for entry in menu:
        for p in entry["parameters"]["properties"].values():
            p.pop("__optional__", None)
    return menu


# ============================================================ bridge
BRIDGE_HEAD = '''"""Retrieval + parsing bridge for the generated needle instance.

Every probe reads the real source and validates records through the strict
models in models.py. Secrets are baked here — never pass them to the model.
Generated by neuralos from profile.json at {now}.
"""
import csv
import io
import json
import os
import re
import subprocess

from models import {model_import}

ROW_CAP = 25
_VALIDATION = {{"parsed": 0, "failed": 0, "errors": []}}
'''

BRIDGE_TAIL_LOG = '''

def parse_tail(lines: int = 50) -> dict:
    lines = max(1, min(int(lines), 500))
    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:
        recent = [l.rstrip("\\n") for l in fh if l.strip()][-lines:]
    parsed, unparsed = [], 0
    for line in recent:
        rec = M.parse_line(line)
        if rec is None:
            unparsed += 1
            continue
        parsed.append(rec.model_dump())
    _VALIDATION["parsed"] += len(parsed)
    _VALIDATION["failed"] += unparsed
    return {"lines_requested": lines, "parsed": len(parsed),
            "unparsed": unparsed, "records": parsed[:ROW_CAP]}


def count_by_level(level: str = "") -> dict:
    counts = {}
    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:
        all_lines = [l.rstrip("\\n") for l in fh if l.strip()]
    for line in all_lines[-5000:]:
        rec = M.parse_line(line)
        lv = getattr(rec, "level", None) if rec else None
        if lv is not None:
            counts[lv] = counts.get(lv, 0) + 1
    if level:
        return {"level": level, "count": counts.get(level, 0)}
    return {"counts": counts}


def search_log(contains: str) -> dict:
    hits = [l for l in _tail(5000) if contains in l]
    return {"contains": contains, "matches": len(hits), "lines": hits[:ROW_CAP]}
'''

BRIDGE_TAIL_FILE = '''

def peek(limit: int = 10) -> dict:
    limit = max(1, min(int(limit), ROW_CAP))
    out = []
    for row in _rows():
        try:
            out.append(M.Record(**row).model_dump())
            _VALIDATION["parsed"] += 1
        except Exception as exc:
            _VALIDATION["failed"] += 1
            if len(_VALIDATION["errors"]) < 5:
                _VALIDATION["errors"].append(str(exc)[:200])
        if len(out) >= limit:
            break
    return {"returned": len(out), "records": out}


def count_records() -> dict:
    return {"count": sum(1 for _ in _rows())}


def summary() -> dict:
    counts, distinct = {}, {}
    for row in _rows():
        for k, v in row.items():
            if v not in (None, ""):
                counts[k] = counts.get(k, 0) + 1
                distinct.setdefault(k, {})
                distinct[k][v] = distinct[k].get(v, 0) + 1
    fields = {}
    for k, d in distinct.items():
        fields[k] = {"non_null": counts.get(k, 0), "distinct": len(d),
                     "top_values": sorted(d.items(), key=lambda kv: -kv[1])[:5]}
        if len(d) <= 12:
            fields[k]["values"] = sorted(d)
    return {"summary": fields}


def count_by_column(column: str, value: str = "") -> dict:
    counts = {}
    for row in _rows():
        key = row.get(column)
        if key is not None:
            counts[key] = counts.get(key, 0) + 1
    if value:
        return {"column": column, "value": value, "count": counts.get(value, 0)}
    return {"column": column,
            "counts": dict(sorted(counts.items(), key=lambda kv: -kv[1])[:ROW_CAP])}
'''


def bridge_database(profile, dsn, dsn_env):
    tables = profile["source"].get("tables", [])
    model_import = ", ".join(pascal(t["name"]) for t in tables) or "BaseModel"
    head = BRIDGE_HEAD.format(now=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                              model_import=model_import)
    body = head + f'''
DSN = os.environ.get("{dsn_env}", "{dsn}")


def _q(sql):
    proc = subprocess.run(["usql", DSN, "-c", "\\\\pset format csv", "-c", sql],
                          capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=120)
    if proc.returncode != 0:
        # a LIST so the call-site guards (rows[0]) work — a bare dict raised
        # KeyError: 0 on every connection failure (caught live by eval #7)
        return [{{"error": (proc.stderr or proc.stdout).strip()[:300]}}]
    lines = [l for l in proc.stdout.splitlines() if l and not l.startswith("Output format")]
    rows = list(csv.DictReader(io.StringIO("\\n".join(lines))))
    # usql CSV prints NULL as an empty cell; the profiler models "" as null,
    # so coerce back — otherwise Optional columns fail on empty strings.
    for r in rows:
        for k in r:
            if r[k] == "":
                r[k] = None
    return rows



def _parse(model, rows):
    parsed, out = [], []
    for row in rows:
        try:
            parsed.append(model(**row).model_dump())
            _VALIDATION["parsed"] += 1
        except Exception as exc:
            _VALIDATION["failed"] += 1
            if len(_VALIDATION["errors"]) < 5:
                _VALIDATION["errors"].append(str(exc)[:200])
            out.append({{k: (str(v)[:80] if v is not None else None)
                        for k, v in row.items()}})
    return parsed, out

'''
    for t in tables:
        tname, tn, tcls = t["name"], snake(t["name"]), pascal(t["name"])
        q = lambda s: "`" + s + "`"
        body += f'''

def {tn}_count() -> dict:
    rows = _q("SELECT COUNT(*) AS n FROM {q(tname)}")
    if rows and "error" in rows[0]:
        return rows[0]
    return {{"table": "{tname}", "count": int(rows[0]["n"]) if rows else 0}}


def {tn}_recent(limit: int = 10, model=None) -> dict:
    model = model or {tcls}
    limit = max(1, min(int(limit), ROW_CAP))
    rows = _q("SELECT * FROM {q(tname)} ORDER BY 1 DESC LIMIT " + str(limit))
    if rows and "error" in rows[0]:
        return rows[0]
    out, _ = _parse(model, rows)
    return {{"table": "{tname}", "returned": len(out), "rows": out}}


def {tn}_summary() -> dict:
    numeric = {json.dumps(num_fields(t["columns"]))}
    summary = {{}}
    for col in numeric:
        rows = _q("SELECT COUNT(*) AS n, MIN(`" + col + "`) AS min_v, "
                  "MAX(`" + col + "`) AS max_v, AVG(`" + col + "`) AS avg_v "
                  "FROM {q(tname)}")
        if rows and "error" not in rows[0]:
            summary[col] = {{k: rows[0].get(k) for k in ("n", "min_v", "max_v", "avg_v")}}
    total = _q("SELECT COUNT(*) AS n FROM {q(tname)}")
    if total and "error" in total[0]:
        return total[0]
    return {{"table": "{tname}", "row_count": int(total[0]["n"]) if total else 0,
            "numeric_summary": summary}}

'''
        for col, values in enum_fields(t["columns"]):
            c = snake(col)
            body += f'''

def {tn}_by_{c}(value: str) -> dict:
    column = "{col}"
    val = str(value).replace("'", "''")   # enum-constrained upstream; escape anyway
    rows = _q("SELECT * FROM {q(tname)} WHERE `" + column + "` = '" + val +
              "' LIMIT " + str(ROW_CAP))
    if rows and "error" in rows[0]:
        return rows[0]
    out, _ = _parse({tcls}, rows)
    counted = _q("SELECT COUNT(*) AS n FROM {q(tname)} WHERE `" + column +
                 "` = '" + val + "'")
    if counted and "error" in counted[0]:
        return counted[0]
    return {{"table": "{tname}", "column": column, "value": str(value),
            "total_matches": int(counted[0]["n"]) if counted else 0,
            "returned": len(out), "rows": out}}

'''
    return body


def bridge_files(profile, log, model_class="Record"):
    model_import = "LogLine" if log else model_class
    head = BRIDGE_HEAD.format(now=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                              model_import=model_import)
    src_lit = json.dumps(profile["source"]["location"])
    mid = f'\nSOURCE = {src_lit}\n'
    if log:
        mid = ('\nimport models as M\n\nSOURCE = ' + src_lit + '\n'
               + '\n\ndef _tail(limit):\n'
                 '    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:\n'
                 '        return [l.rstrip("\\n") for l in fh if l.strip()][-limit:]\n')
        return head + mid + BRIDGE_TAIL_LOG
    kind = profile["source"]["kind"]
    if kind == "json_lines":
        # JSONL/NDJSON: one object per line — json.load() on the whole file
        # dies with "Extra data" on line 2 (caught live by eval #4). Records
        # are FLATTENED exactly as the profiler did — the models are built
        # from flattened dot-paths, so raw nested rows fail extra="forbid"
        # (coverage 0%, caught live by eval #4 as well).
        read = ('''\ndef _flatten(obj, prefix="", depth=0, out=None):
    out = out if out is not None else {}
    if depth > 4:
        out[prefix] = json.dumps(obj)[:400]
        return out
    if isinstance(obj, dict):
        if not obj:
            out[prefix] = {}
            return out
        for k, v in obj.items():
            _flatten(v, f"{prefix}.{k}" if prefix else k, depth + 1, out)
    elif isinstance(obj, list):
        if not obj:
            out[prefix] = []
            return out
        _flatten(obj[0], f"{prefix}[]", depth + 1, out)
    else:
        out[prefix] = obj
    return out


def _rows():
    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:
        out = []
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(_flatten(json.loads(line)))
            except json.JSONDecodeError:
                continue
        return out


''')
    elif kind.startswith("json"):
        read = ('''\ndef _flatten(obj, prefix="", depth=0, out=None):
    out = out if out is not None else {}
    if depth > 4:
        out[prefix] = json.dumps(obj)[:400]
        return out
    if isinstance(obj, dict):
        if not obj:
            out[prefix] = {}
            return out
        for k, v in obj.items():
            _flatten(v, f"{prefix}.{k}" if prefix else k, depth + 1, out)
    elif isinstance(obj, list):
        if not obj:
            out[prefix] = []
            return out
        _flatten(obj[0], f"{prefix}[]", depth + 1, out)
    else:
        out[prefix] = obj
    return out


def _rows():
    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:
        data = json.load(fh)
    if isinstance(data, dict):
        data = next((v for v in data.values() if isinstance(v, list)), [])
    return [_flatten(r) for r in data]


''')
    else:
        read = ('''\ndef _rows():
    with open(SOURCE, "r", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh):
            # k is None when a row has more cells than the header (restkey) —
            # drop it instead of letting a TypeError masquerade as a parse failure
            yield {k: (v if v != "" else None) for k, v in row.items()
                   if k is not None}


''')
    return head + mid + read + BRIDGE_TAIL_FILE.replace("M.Record", model_class)


# ============================================================ instance
def tool_block(name, description, triggers, params, call):
    return ('\n\n@needle.tool(triggers=' + repr(triggers) + ')\n'
            + f'def {name}({params}) -> dict:\n'
            + f'    """{description}"""\n'
            + f'    return bridge.{call}\n'
            + f'TOOLS.append({name})\n')


def instance_code(profile, table, agent_name, example):
    kind = profile["source"]["kind"]
    tools = []

    def tool(name, description, triggers, params, call):
        tools.append(tool_block(name, description, triggers, params, call))

    if kind == "database":
        for t in profile["source"].get("tables", []):
            tname, tn, tcls = t["name"], snake(t["name"]), pascal(t["name"])
            tool(f"{tn}_count", f"Count rows in the {tname} table.",
                 [f"how many {tn}", f"count all {tn} rows", f"{tn} total", f"{tn} row count"],
                 "", f'{tn}_count()')
            tool(f"{tn}_recent", f"Most recent rows from {tname}, newest first.",
                 [f"recent {tn}", f"latest {tn}", f"show {tn}", f"last {tn} rows"],
                 "limit: int = 10",
                 f'{tn}_recent(limit=limit, model={tcls})')
            tool(f"{tn}_summary", f"Aggregate summary of {tname}: row count plus "
                 f"min/max/average of every numeric column.",
                 [f"{tn} summary", f"{tn} stats", f"aggregate {tn}", f"{tn} numbers"],
                 "", f'{tn}_summary()')
            for col, values in enum_fields(t["columns"]):
                c = snake(col)
                lit = "Literal[" + ", ".join(json.dumps(v) for v in values[:ENUM_MAX]) + "]"
                tool(f"{tn}_by_{c}", f"Count and list {tname} rows where {col} matches a "
                     f"specific value.", [f"{tn} by {c}", f"{tn} where {c}"],
                     f"value: {lit}",
                     f'{tn}_by_{c}(value=value)')
    elif kind == "log_lines":
        levels = sorted({lv for t in profile.get("log_templates", [])
                         for lv in t.get("distinct_values", {}).get("level", [])})
        tool("parse_tail", "Parse the newest log lines through the typed templates.",
             ["parse tail", "recent lines", "last log lines", "parse logs"],
             "lines: int = 50", "parse_tail(lines=lines)")
        if levels:
            lit = "Literal[" + ", ".join(json.dumps(v) for v in levels[:ENUM_MAX]) + "]"
            tool("count_by_level", "Count log lines per level, or one specific level.",
                 ["count by level", "errors in the log", "log level counts"],
                 f"level: {lit} = \"\"", "count_by_level(level=level)")
        tool("search_log", "Find log lines containing a substring.",
             ["search log", "find in log", "grep log"],
             'contains: str', "search_log(contains=contains)")
    else:
        tool("peek", "Fetch the first records, parsed and validated.",
             ["peek", "first records", "show records", "sample the data"],
             "limit: int = 10", "peek(limit=limit)")
        tool("count_records", "Count the records in the source.",
             ["how many records", "count records", "record count"], "", "count_records()")
        tool("summary", "Per-field summary: non-null counts, distinct and top values.",
             ["summary", "field summary", "data profile", "stats"], "", "summary()")
        for col, values in enum_fields(profile.get("fields", [])):
            c = snake(col)
            lit = "Literal[" + ", ".join(json.dumps(v) for v in values[:ENUM_MAX]) + "]"
            tool(f"count_by_{c}", f"Count records grouped by {col}, or for one value.",
                 [f"by {c}", f"group by {c}", f"count by {c}"],
                 f"value: {lit} = \"\"", f"count_by_column(column=\"{col}\", value=value)")

    model_imports = ""
    if kind == "database":
        model_imports = "from models import " + ", ".join(
            pascal(t["name"]) for t in profile["source"].get("tables", []))
    elif kind == "log_lines":
        model_imports = "import models as M"

    return f'''"""neuralOS/needle instance for {agent_name} — generated by neuralos.

Run:      {sys.executable} instance.py "your question in plain English"
Coverage: {sys.executable} instance.py --coverage   (after running probes)
"""

import json
import sys
from typing import Literal

import needle

import bridge
{model_imports}

TOOLS = []
{"".join(tools)}

# Reproducibility posture (live lessons from the chinook/soc instances):
# - fixed system facts + auto_date=False: the drifting date fact flips
#   121M tool selection between runs
# - max_steps=1: the probes are self-contained; over-calling (one correct
#   probe plus a bonus unrelated call) was observed with the default 8
# - tool_index_path above ~12 tools: in-context tool sets misroute past that
SYSTEM_FACTS = "A data instance. Pick the ONE best probe for the request; after its result, answer immediately."


def main() -> None:
    if "--coverage" in sys.argv:
        print(json.dumps(getattr(bridge, "_VALIDATION", {{}}), indent=2))
        total = bridge._VALIDATION.get("parsed", 0) + bridge._VALIDATION.get("failed", 0)
        if total:
            print("coverage: %.1f%% of records parsed cleanly"
                  % (100 * bridge._VALIDATION["parsed"] / total))
        return
    question = " ".join(sys.argv[1:]).strip() or {example!r}
    print("question:", question)
    agent = needle.Needle(
        tools=TOOLS, system=SYSTEM_FACTS, auto_date=False,
        tool_index_path=".tool_index.json" if len(TOOLS) > 12 else None)
    try:
        response = agent.run(question, max_steps=1)
    finally:
        agent.close()
    print()
    print("reasoning :", response.get("reasoning"))
    print("confidence:", response.get("confidence"))
    for result in response.get("results") or []:
        print("result    :", json.dumps(result, ensure_ascii=False, default=str)[:1500])


if __name__ == "__main__":
    main()
'''


# ============================================================ verify / readme
VERIFY = '''#!/usr/bin/env python3
"""Phase-4 verification: model coverage + selection test.

    python verify.py            # fetch a sample, then report coverage
    python verify.py --full     # also run a 3-phrasing selection test
"""
import json
import os
import subprocess
import sys

import bridge

SAMPLE_CALL = lambda: {sample_call}   # executed, not printed
PHRASINGS = {phrasings}


def fetch_sample():
    print("== fetching a sample through the bridge ==")
    result = SAMPLE_CALL()
    print(json.dumps(result, ensure_ascii=False, default=str)[:400])


def coverage():
    print("== model coverage ==")
    v = getattr(bridge, "_VALIDATION", {})
    print(json.dumps(v, indent=2))
    total = v.get("parsed", 0) + v.get("failed", 0)
    if total:
        print("coverage: %.1f%% (%d/%d records parsed cleanly)"
              % (100 * v["parsed"] / total, v["parsed"], total))
    else:
        print("coverage: no records parsed yet — fetch_sample above must have failed; "
              "check the bridge error output")


def selection():
    print("== selection test (3 phrasings) ==")
    if not os.path.exists("instance.py"):
        print("(engine runtime: no instance.py generated — run the engine binary "
              "with needle_menu.json and the same phrasings instead)")
        return
    for phrasing in PHRASINGS:
        out = subprocess.run([sys.executable, "instance.py", phrasing],
                             capture_output=True, text=True)
        for line in out.stdout.splitlines():
            if line.startswith("reasoning") or line.startswith("result"):
                print(f"  [{phrasing!r}] {line[:160]}")


if __name__ == "__main__":
    fetch_sample()
    coverage()
    if "--full" in sys.argv:
        selection()
'''

README = '''# {agent} — generated needle instance

Source kind : {kind}
Runtime     : {runtime}
Menu        : needle_menu.json ({n_probes} probes)

## Run (Python runtime)

    {py} instance.py "your question in plain English"

## Verify (Phase 4 — never skip)

    {py} verify.py            # model coverage
    {py} verify.py --full     # + 3-phrasing selection test
Then compare one relayed number against a direct query of the source and
record all three results in verification.txt.

## Engine runtime

`needle_menu.json` feeds the standalone engine directly:

    ./<platform>/needle --model <archive> --tools {out}/needle_menu.json --prompt "..."

The engine selects and fills the call; execution stays with this directory's
`bridge.py`.

## Extending

Data changed shape? Re-run the neuralos workflow (profile → model →
generate) and diff. New write-capable probes: only behind an explicit approval
flag, with identity checks in the bridge.
'''


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--profile", default="profile.json")
    ap.add_argument("--models", default="models.py")
    ap.add_argument("--out", default="instance")
    ap.add_argument("--db-dsn", default="", help="DSN baked into the bridge")
    ap.add_argument("--dsn-env", default="NEURALOS_DSN")
    ap.add_argument("--runtime", choices=["python", "engine"], default="python")
    ap.add_argument("--agent-name")
    ap.add_argument("--table", help="database table (default: first profiled)")
    args = ap.parse_args()

    profile = json.load(open(args.profile, encoding="utf-8"))
    kind = profile["source"]["kind"]
    # Detect the first model class from the SOURCE models.py (the copy into
    # --out happens later — scanning the out dir here always missed it and
    # left file-source bridges importing a nonexistent "Record").
    model_class = "Record"
    if os.path.exists(args.models):
        for line in open(args.models, encoding="utf-8"):
            mcls = re.match(r"class (\w+)\(", line)
            if mcls:
                model_class = mcls.group(1)
                break
    table = args.table or (profile["source"].get("tables") or [{}])[0].get("name")
    agent_name = args.agent_name or snake(os.path.basename(
        profile["source"]["location"]).split(".")[0].replace(":", "_")) or "feed"

    os.makedirs(args.out, exist_ok=True)
    if os.path.exists(args.models):
        import shutil
        src_m, dst_m = os.path.abspath(args.models), os.path.abspath(
            os.path.join(args.out, "models.py"))
        if src_m != dst_m:
            shutil.copy(src_m, dst_m)
    menu = build_menu(profile, table, agent_name)
    menu_path = os.path.join(args.out, "needle_menu.json")
    with open(menu_path, "w", encoding="utf-8") as fh:
        json.dump(menu, fh, indent=2, ensure_ascii=False)

    loc = profile["source"]["location"]
    if kind != "database" and loc.lower().endswith((".xlsx", ".xls")):
        # The bridge reads delimited text — a binary xlsx read as CSV yields
        # garbage (0% coverage, caught live by eval #6). Convert values-only
        # to a CSV snapshot beside the instance, exactly as the profiler did.
        try:
            import openpyxl
        except ImportError:
            raise SystemExit("xlsx instances need openpyxl: pip install openpyxl")
        wb = openpyxl.load_workbook(loc, read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        os.makedirs(args.out, exist_ok=True)
        snap = os.path.abspath(os.path.join(args.out, "source_snapshot.csv"))
        import csv as _csv
        with open(snap, "w", newline="", encoding="utf-8") as fh:
            cw = _csv.writer(fh)
            for row in ws.iter_rows(values_only=True):
                cw.writerow(["" if c is None else str(c) for c in row])
        profile["source"]["location"] = snap
        profile["source"]["origin_workbook"] = loc
    elif kind != "database" and loc.startswith("http"):
        # URL-sourced profile: the bridge cannot open() an https:// path
        # (caught live by eval #5 — FileNotFoundError on the URL). Snapshot
        # the fetched body beside the instance so it stays offline-runnable,
        # and record the origin in the profile.
        import urllib.request
        req = urllib.request.Request(loc, headers={"User-Agent": "neuralos-generator/1.0"})
        body = urllib.request.urlopen(req, timeout=60).read(4 * 1024 * 1024)
        os.makedirs(args.out, exist_ok=True)
        snap = os.path.abspath(os.path.join(args.out, "source_snapshot"))
        open(snap, "wb").write(body)
        profile["source"]["location"] = snap
        profile["source"]["origin_url"] = loc
    elif kind != "database" and not loc.startswith("/") and os.path.exists(loc):
        profile["source"]["location"] = os.path.abspath(loc)
    dsn = args.db_dsn or (profile["source"]["location"] if kind == "database" else "")
    if kind == "database" and dsn.startswith("sqlite:///"):
        _sp = dsn[len("sqlite:///"):]
        if not os.path.isabs(_sp):
            # relative sqlite path breaks when the instance runs from its own
            # directory (caught live by eval #7) — bake the absolute path
            # "sqlite://" + abspath == exactly 3 slashes before the path;
            # a 4th slash makes usql fail to open the file (caught by eval #7)
            dsn = "sqlite://" + os.path.abspath(_sp)
    bridge_code = (bridge_database(profile, dsn, args.dsn_env)
                   if kind == "database" else bridge_files(profile, log=(kind == "log_lines"), model_class=model_class))
    open(os.path.join(args.out, "bridge.py"), "w", encoding="utf-8").write(bridge_code)

    # Graph layer (Phase-1 relationship discovery, optional): when its outputs
    # exist beside the profile, ride them along so the instance directory
    # matches the SKILL.md contract (graph_edges.json + graph_bridge.py).
    import shutil
    graph_edges = os.path.join(
        os.path.dirname(os.path.abspath(args.profile)), "graph_edges.json")
    if os.path.exists(graph_edges):
        shutil.copy(graph_edges, os.path.join(args.out, "graph_edges.json"))
    graph_bridge_src = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "graph_bridge.py")
    if os.path.exists(graph_bridge_src):
        shutil.copy(graph_bridge_src, os.path.join(args.out, "graph_bridge.py"))

    if args.runtime == "python":
        example = (f"give me the {snake(table or agent_name)} summary"
                   if kind == "database" else "show me a summary of the data")
        open(os.path.join(args.out, "instance.py"), "w", encoding="utf-8").write(
            instance_code(profile, table, agent_name, example))

    model_cls = pascal(table) if kind == "database" else ("LogLine" if kind == "log_lines" else "Record")
    if kind == "database":
        sample_call = f'bridge.{snake(table)}_recent(limit=10, model={pascal(table)})'
        phrasings = [f"how many {snake(table)}", f"count all {snake(table)} rows",
                     f"{snake(table)} total"]
    elif kind == "log_lines":
        sample_call = "bridge.parse_tail(lines=50)"
        phrasings = ["count by level", "errors in the log", "log level counts"]
    else:
        sample_call = "bridge.peek(limit=10)"
        phrasings = ["how many records", "count records", "record count"]
    verify_code = VERIFY.replace("{sample_call}", sample_call).replace(
        "{phrasings}", repr(phrasings))
    if kind == "database":
        verify_code = verify_code.replace(
            "import bridge\n",
            "import bridge\nfrom models import " + pascal(table) + "\n")
    open(os.path.join(args.out, "verify.py"), "w", encoding="utf-8").write(verify_code)
    open(os.path.join(args.out, "README.md"), "w", encoding="utf-8").write(
        README.format(agent=agent_name, kind=kind, runtime=args.runtime,
                      n_probes=len(menu), out=os.path.abspath(args.out),
                      py=sys.executable))

    print(f"instance written: {args.out}/")
    print(f"  probes on menu : {len(menu)} -> " + ", ".join(m["name"] for m in menu))
    print(f"  runtime        : {args.runtime}")


if __name__ == "__main__":
    main()
