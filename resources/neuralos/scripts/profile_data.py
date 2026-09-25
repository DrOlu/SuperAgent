#!/usr/bin/env python3
"""Universal data profiler for the neuralos skill.

Profiles ANY data source and emits a machine-readable profile.json that the
generator scripts (gen_pydantic.py, gen_needle_instance.py) turn into strict
Pydantic models and needle instances.

Sources:
  - file paths: .csv/.tsv/.txt (delimited), .json, .jsonl/.ndjson,
    .log/.out/.txt (line templates), .db/.sqlite, .xlsx (if openpyxl installed);
    unknown extensions are content-sniffed
  - database DSNs: mysql://, postgres://, ... via the `usql` CLI;
    sqlite:///path via the stdlib sqlite3 module
  - https:// URLs: fetched, then content-sniffed

Usage:
  python profile_data.py --source data.csv --out profile.json
  python profile_data.py --source mysql://user:pw@host/db --table transactions --out profile.json
  python profile_data.py --source app.log --max-lines 5000 --out profile.json
"""

import argparse
import csv
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone

INT_RE = re.compile(r"^-?\d+$")
NUM_RE = re.compile(r"^-?\d+(\.\d+)?$")
BOOL_VALUES = {"true", "false", "yes", "no"}
DT_FORMATS = [
    "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S",
    "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%b %d %H:%M:%S", "%H:%M:%S",
]
ENUM_THRESHOLD = 12
TS_RE = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}")
IP_RE = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$")
LEVEL_RE = re.compile(r"^[A-Z]{4,7}$")


def note(profile, msg):
    profile.setdefault("notes", []).append(msg)


def sniff_datetime(value):
    for fmt in DT_FORMATS:
        try:
            datetime.strptime(value, fmt)
            return fmt
        except ValueError:
            continue
    return None


def infer_type(values):
    """values: list of raw values (str/int/float/bool/None excluded by caller)."""
    strs = [str(v) for v in values]
    if all(INT_RE.match(s) for s in strs):
        return "integer"
    if all(NUM_RE.match(s) for s in strs):
        return "number"
    if all(s.lower() in BOOL_VALUES for s in strs):
        return "boolean"
    if all(sniff_datetime(s) for s in strs):
        return "datetime"
    return "string"


def profile_field(name, values):
    """values: non-null raw values from the sample. Returns a field dict."""
    field = {
        "name": name,
        "nullable": False,
        "null_count": 0,
        "sample_count": len(values),
        "distinct": len(set(map(str, values))),
    }
    nonnull = [v for v in values if v is not None and str(v).strip() != ""]
    field["null_count"] = len(values) - len(nonnull)
    field["nullable"] = field["null_count"] > 0
    if not nonnull:
        field["detected_type"] = "string"
        field["python_type"] = "Optional[str]"
        field["note"] = "all sampled values empty"
        return field
    detected = infer_type(nonnull)
    field["detected_type"] = detected
    field["python_type"] = {"integer": "int", "number": "float",
                            "boolean": "bool", "datetime": "datetime"}.get(detected, "str")
    strs = [str(v) for v in nonnull]
    field["sample_values"] = list(dict.fromkeys(strs))[:8]
    if detected == "integer":
        nums = [int(v) for v in strs]
        field["min"], field["max"] = min(nums), max(nums)
    elif detected == "number":
        nums = [float(v) for v in strs]
        field["min"], field["max"] = min(nums), max(nums)
    elif detected == "string":
        lens = [len(s) for s in strs]
        field["min_len"], field["max_len"] = min(lens), max(lens)
    # Only STRINGS become enum candidates. Datetime columns with few distinct
    # values must stay datetime (a Literal of observed dates breaks on the
    # next day's data — hit live on chinook).
    if (detected == "string" and field["distinct"] <= ENUM_THRESHOLD
            and field["distinct"] < len(nonnull)):
        field["enum_values"] = sorted(set(strs))
        field["python_type"] = "Literal"
    if detected == "datetime":
        field["datetime_format"] = sniff_datetime(strs[0])
    return field


def sample_jsonsafe(obj):
    if isinstance(obj, bool) or obj is None:
        return obj
    if isinstance(obj, (int, float, str)):
        return obj
    return str(obj)


def jsonsafe_row(row):
    return {k: sample_jsonsafe(v) for k, v in row.items()}


# ---------------------------------------------------------------- delimited
def profile_delimited(path, sample, profile, delimiter=None):
    raw = open(path, "r", encoding="utf-8", errors="replace").read(4 * 1024 * 1024)
    if delimiter is None:
        try:
            delimiter = csv.Sniffer().sniff(raw[:4096], delimiters=",;\t|").delimiter
        except csv.Error:
            delimiter = ","
    reader = csv.reader(io.StringIO(raw), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        raise SystemExit("empty file")
    columns = {h: [] for h in header}
    n_rows = 0
    samples = []
    for row in reader:
        if not any(cell.strip() for cell in row):
            continue
        n_rows += 1
        for h, v in zip(header, row):
            columns[h].append(v if v != "" else None)
        if len(samples) < sample:
            samples.append({h: (v if v != "" else None) for h, v in zip(header, row)})
    profile["source"].update({"kind": "delimited", "dialect": {"delimiter": delimiter},
                              "row_count": n_rows})
    profile["fields"] = [profile_field(h, cols) for h, cols in columns.items()]
    profile["sample_records"] = samples


# ---------------------------------------------------------------- json
def flatten(obj, prefix="", depth=0, out=None):
    out = out if out is not None else {}
    if depth > 4:
        out[prefix] = json.dumps(obj)[:400]
        return out
    if isinstance(obj, dict):
        if not obj:
            out[prefix] = {}
            return out
        for k, v in obj.items():
            flatten(v, f"{prefix}.{k}" if prefix else k, depth + 1, out)
    elif isinstance(obj, list):
        if not obj:
            out[prefix] = []
            return out
        flatten(obj[0], f"{prefix}[]", depth + 1, out)
    else:
        out[prefix] = obj
    return out


def profile_json_records(records, sample, profile, kind):
    # Flatten BEFORE making values json-safe: jsonsafe_row stringifies nested
    # dicts/objects, which stops flatten() from ever recursing into them —
    # every nested field then profiles as one stringified blob (caught live by
    # eval #4: 'details' as a str instead of details.channel/…). JSON sources
    # are pure json.loads output, so raw leaves are already JSON scalars.
    flattened = [flatten(r) for r in records[:sample]]
    keys = []
    for rec in flattened:
        for k in rec:
            if k not in keys:
                keys.append(k)
    columns = {k: [] for k in keys}
    for rec in flattened:
        for k in keys:
            columns[k].append(rec.get(k))
    profile["source"].update({"kind": kind, "record_count": len(records)})
    profile["fields"] = [profile_field(k, v) for k, v in columns.items()]
    profile["sample_records"] = flattened[:sample]


def profile_json(path, sample, profile):
    text = open(path, "r", encoding="utf-8", errors="replace").read()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON in {path}: {exc}")
    if isinstance(data, list):
        profile_json_records(data, sample, profile, "json_array")
    elif isinstance(data, dict):
        list_val = next((v for v in data.values() if isinstance(v, list)), None)
        if list_val and isinstance(list_val[0], dict):
            note(profile, "single-record object: profiling the nested list "
                          f"'{next(k for k, v in data.items() if v is list_val)}'")
            profile_json_records(list_val, sample, profile, "json_array")
        else:
            flat = flatten(jsonsafe_row(data))
            profile["source"].update({"kind": "json_doc"})
            profile["fields"] = [profile_field(k, [v]) for k, v in flat.items()]
            profile["sample_records"] = [flat]
    else:
        raise SystemExit("JSON root is a scalar")


def profile_jsonl(path, sample, profile):
    records = []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    profile_json_records(records, sample, profile, "json_lines")


# ---------------------------------------------------------------- logs
VAR_SHAPES = [
    ("timestamp", TS_RE),
    ("ipv4", IP_RE),
    ("uuid", UUID_RE),
    ("number", re.compile(r"^-?\d+(\.\d+)?$")),
    ("bracketed", re.compile(r"^\[[^\]]+\]$")),
    ("word", re.compile(r"^[A-Za-z][A-Za-z0-9_./@:-]*$")),
]


def var_regex(token):
    if TS_RE.search(token) and not re.fullmatch(r"\S+\|\S+", token):
        return r"\S+"
    for name, rx in VAR_SHAPES:
        if rx.match(token):
            if name == "bracketed":
                return r"\[[^\]]+\]"
            if name == "ipv4":
                return r"(?:\d{1,3}\.){3}\d{1,3}"
            if name == "uuid":
                return r"[0-9a-fA-F-]{36}"
            if name == "number":
                return r"-?\d+(?:\.\d+)?"
            if name == "timestamp":
                return r"\S+"
    return r"\S+"


def field_name_for(token, position):
    if re.fullmatch(r"\d{2}:\d{2}:\d{2}", token):
        return "time"
    if LEVEL_RE.match(token):
        return "level"
    if TS_RE.search(token):
        return "timestamp"
    if IP_RE.match(token):
        return "ip"
    if token.startswith("[") and LEVEL_RE.match(token.strip("[]")):
        return "level"
    if INT_RE.match(token):
        return f"num_{position}"
    m = re.match(r"^([A-Za-z_]+)[=:]", token)
    if m:
        return m.group(1).lower()
    return f"var_{position}"


def profile_log(path, sample, profile, max_lines=5000):
    lines = []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if line.strip():
                lines.append(line)
            if len(lines) >= max_lines:
                break
    groups = {}
    for line in lines:
        groups.setdefault(len(line.split()), []).append(line)
    templates = []
    for count, group in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        if len(group) < 2:
            continue
        first_tokens = group[0].split()
        template_tokens, fields = [], []
        for pos in range(count):
            column = {ln.split()[pos] for ln in group if len(ln.split()) == count}
            if len(column) == 1:
                template_tokens.append(re.escape(next(iter(column))))
            else:
                token = sorted(column)[0]
                name = field_name_for(token, pos)
                template_tokens.append(f"(?P<{name}>{var_regex(token)})")
                fields.append(name)
        regex = "^" + r"\s+".join(template_tokens) + "$"
        matched = sum(1 for ln in group if re.match(regex, ln))
        if matched < len(group) * 0.7:
            continue
        templates.append({"regex": regex, "example": group[0][:300],
                          "line_count": len(group), "fields": fields,
                          "distinct_values": {f: sorted({re.search(regex, ln).group(f)
                                              for ln in group if re.search(regex, ln)})[:8]
                                              for f in fields}})
    templates.sort(key=lambda t: -t["line_count"])
    profile["source"].update({"kind": "log_lines", "line_count": len(lines)})
    profile["log_templates"] = templates[:8]
    profile["sample_records"] = [{"line": ln[:300]} for ln in lines[:sample]]
    if not templates:
        note(profile, "no stable line template found — treat as unstructured text")


# ---------------------------------------------------------------- databases
def _usql(dsn, sql):
    proc = subprocess.run(
        ["usql", dsn, "-c", "\\pset format csv", "-c", sql],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
    if proc.returncode != 0:
        raise SystemExit(f"usql query failed: {(proc.stderr or proc.stdout).strip()[:300]}")
    lines = [l for l in proc.stdout.splitlines() if l and not l.startswith("Output format")]
    return list(csv.DictReader(io.StringIO("\n".join(lines))))


def profile_database(dsn, table, sample, profile, max_tables=32):
    if dsn.startswith("sqlite"):
        return profile_sqlite(dsn, table, sample, profile)
    if table:
        tables = [table]
    else:
        tables = [r["TABLE_NAME"] for r in _usql(
            dsn, "SELECT TABLE_NAME FROM information_schema.TABLES "
                 "WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME;")]
    if not tables:
        raise SystemExit("no tables found")
    if len(tables) > max_tables:
        dropped = tables[max_tables:]
        note(profile, f"{len(tables)} tables found; profiling only the first "
             f"{max_tables}. Not profiled: {', '.join(dropped[:10])}"
             + (" ..." if len(dropped) > 10 else ""))
        tables = tables[:max_tables]
    profile["source"].update({"kind": "database", "tables": []})
    for t in tables:
        cols = _usql(dsn,
                     "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE "
                     "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                     f"AND TABLE_NAME = '{t}' ORDER BY ORDINAL_POSITION;")
        if not cols:
            continue
        rows = _usql(dsn, f"SELECT * FROM `{t}` ORDER BY 1 DESC LIMIT {sample};")
        tprofile = {"name": t, "db_row_count": None, "columns": [], "sample_records": rows}
        counts = _usql(dsn, f"SELECT COUNT(*) AS n FROM `{t}`;")
        if counts:
            tprofile["db_row_count"] = int(counts[0].get("n", 0) or 0)
        by_name = {c["COLUMN_NAME"]: c for c in cols}
        names = [c["COLUMN_NAME"] for c in cols]
        values = {n: [jsonsafe_row(r).get(n) for r in rows] for n in names}
        for n in names:
            meta = by_name[n]
            f = profile_field(n, values[n])
            f["db_type"] = meta.get("COLUMN_TYPE") or meta.get("DATA_TYPE")
            f["db_nullable"] = meta.get("IS_NULLABLE") == "YES"
            # A DB-declared ENUM is the authoritative, complete vocabulary —
            # replace any sample-derived candidates with it (sample enums
            # silently reject legal values that never appeared in the sample).
            m = re.match(r"^enum\((.*)\)$", f["db_type"] or "", re.S)
            if m:
                vals = [v.replace("\\'", "'").replace('""', '"')
                        for v in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1))]
                if vals:
                    f["enum_values"] = vals
                    f["enum_source"] = "database ENUM declaration"
                    f["distinct"] = len(vals)
                    f["python_type"] = "Literal"
            if f["db_nullable"] and not f["nullable"]:
                f["python_type"] = "Optional[" + f["python_type"].replace("Optional[", "").replace("]", "") + "]"
            tprofile["columns"].append(f)
        profile["source"]["tables"].append(tprofile)
        if table:
            profile["fields"] = tprofile["columns"]
            profile["sample_records"] = rows
    note(profile, "field statistics computed from the sampled rows, not a full scan")


def profile_sqlite(dsn, table, sample, profile):
    path = dsn.split("///")[-1].split("?")[0]
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if not table:
        table = cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchone()
        table = table[0] if table else None
    if not table:
        raise SystemExit("no tables found")
    cols = [(r[1], r[2]) for r in cur.execute(f"PRAGMA table_info('{table}')")]
    rows = [dict(r) for r in cur.execute(f"SELECT * FROM \"{table}\" LIMIT {sample}")]
    n = cur.execute(f"SELECT COUNT(*) FROM \"{table}\"").fetchone()[0]
    tprofile = {"name": table, "db_row_count": n, "columns": [], "sample_records": rows}
    for name, dbtype in cols:
        f = profile_field(name, [r.get(name) for r in rows])
        f["db_type"] = dbtype
        tprofile["columns"].append(f)
    profile["source"].update({"kind": "database", "tables": [tprofile]})
    profile["fields"] = tprofile["columns"]
    profile["sample_records"] = rows
    conn.close()


# ---------------------------------------------------------------- entry
def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--source", required=True, help="file path, DSN, or https URL")
    ap.add_argument("--table", help="database table to profile (default: all/first)")
    ap.add_argument("--max-tables", type=int, default=32,
                    help="max tables profiled per database (default 32; dropped "
                         "tables are listed in profile notes)")
    ap.add_argument("--sample", type=int, default=50, help="rows/values sampled (default 50)")
    ap.add_argument("--max-lines", type=int, default=5000, help="log lines scanned (default 5000)")
    ap.add_argument("--out", default="profile.json", help="output profile path")
    args = ap.parse_args()

    profile = {"source": {"location": args.source}, "profiled_at":
               datetime.now(timezone.utc).isoformat(timespec="seconds")}
    src = args.source

    if "://" in src and not src.startswith(("http://", "https://")):
        profile_database(src, args.table, args.sample, profile,
                         max_tables=args.max_tables)
        finalize(profile, args.out)
    elif src.startswith("http"):
        import urllib.request
        req = urllib.request.Request(src, headers={"User-Agent": "neuralos-profiler/1.0"})
        raw = urllib.request.urlopen(req, timeout=60).read(4 * 1024 * 1024)
        tmp = f"/tmp/neuralos_data_fetch_{os.getpid()}"
        open(tmp, "wb").write(raw)
        return main_for_path(tmp, sample=args.sample, profile=profile, out=args.out,
                             fetch_note=f"fetched from {src}", sniff=True)
    else:
        if not os.path.exists(src):
            raise SystemExit(f"no such file: {src}")
        main_for_path(src, sample=args.sample, profile=profile, out=args.out,
                      sniff=not os.path.splitext(src)[1])


def sniff_content(src):
    """Classify a file by its content: 'json' | 'jsonl' | 'delimited' | 'log' | None."""
    try:
        text = open(src, "r", encoding="utf-8", errors="replace").read(256 * 1024)
    except OSError:
        return None
    stripped = text.lstrip()
    if stripped.startswith(("{", "[")):
        try:
            json.loads(text)
            return "json"
        except json.JSONDecodeError:
            first = stripped.splitlines()[0] if stripped else ""
            try:
                json.loads(first)
                return "jsonl"
            except json.JSONDecodeError:
                return None
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return None
    if looks_like_log(src):
        return "log"
    try:
        csv.Sniffer().sniff("\n".join(lines[:20]), delimiters=",;\t|")
        return "delimited"
    except csv.Error:
        return None


def main_for_path(src, sample, profile, out, fetch_note=None, sniff=False):
    ext = os.path.splitext(src)[1].lower()
    if fetch_note:
        note(profile, fetch_note)
    if sniff:
        kind = sniff_content(src)
        if kind == "json":
            note(profile, "content-sniffed as JSON")
            ext = ".json"
        elif kind == "jsonl":
            note(profile, "content-sniffed as JSON lines")
            ext = ".jsonl"
        elif kind == "delimited":
            note(profile, "content-sniffed as delimited text")
            ext = ".csv"
        elif kind == "log":
            note(profile, "content-sniffed as log lines")
            ext = ".log"
        elif ext not in (".csv", ".tsv", ".txt", ".json", ".jsonl", ".ndjson",
                         ".db", ".sqlite", ".sqlite3", ".xlsx", ".log", ".out"):
            raise SystemExit(f"unrecognized source type for {src}; "
                             "rename with a known extension or convert first")
    if ext in (".csv", ".tsv") or (ext == ".txt" and not looks_like_log(src)):
        profile_delimited(src, sample, profile)
    elif ext in (".jsonl", ".ndjson"):
        profile_jsonl(src, sample, profile)
    elif ext == ".json":
        profile_json(src, sample, profile)
    elif ext in (".db", ".sqlite", ".sqlite3"):
        profile_database("sqlite:///" + src, None, sample, profile)
    elif ext == ".xlsx":
        try:
            import openpyxl
        except ImportError:
            raise SystemExit("xlsx profiling needs openpyxl: pip install openpyxl")
        wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = [[("" if c is None else str(c)) for c in row] for row in ws.iter_rows(values_only=True)]
        tmp = src + ".sniff.csv"
        with open(tmp, "w", newline="", encoding="utf-8") as fh:
            cw = csv.writer(fh)
            cw.writerows(rows[:20000])
        profile_delimited(tmp, sample, profile)
        profile["source"]["location"] = src
        os.unlink(tmp)
    elif ext in (".log", ".out") or looks_like_log(src):
        profile_log(src, sample, profile, max_lines=int(os.environ.get("MAX_LINES", 5000)))
    else:
        raise SystemExit(f"unrecognized source type for {src}; "
                         "rename with a known extension or convert first")
    finalize(profile, out)


def looks_like_log(src):
    try:
        with open(src, "r", encoding="utf-8", errors="replace") as fh:
            head = [fh.readline() for _ in range(20)]
    except OSError:
        return False
    body = [l for l in head if l.strip()]
    if not body:
        return False
    widths = {len(l.split()) for l in body}
    return len(widths) <= 2 and TS_RE.search("".join(body[:3])) is not None


def finalize(profile, out):
    if not profile["source"].get("kind"):
        profile["source"]["kind"] = "unknown"
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(profile, fh, indent=2, ensure_ascii=False, default=str)
    kinds = profile["source"].get("kind")
    n = len(profile.get("fields", [])) or sum(
        len(t.get("columns", [])) for t in profile["source"].get("tables", []))
    print(f"profile written: {out}")
    print(f"  source kind: {kinds} | fields profiled: {n} | "
          f"templates: {len(profile.get('log_templates', []))} | "
          f"notes: {len(profile.get('notes', []))}")


if __name__ == "__main__":
    main()
