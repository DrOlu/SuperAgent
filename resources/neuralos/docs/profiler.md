# The profiler — what it measures and where it stops

`profile_data.py` emits `profile.json`. Read it before modeling. Everything
downstream (Pydantic constraints, menu argument grammar) is derived from it.

## What each source kind produces

| Kind | Fields from | Row/sample counts | Extras |
|---|---|---|---|
| `database` | information_schema columns + sampled values | exact COUNT(*) per table | db_type, db_nullable per column; stats from the sample |
| `delimited` | header + cell values | exact row count (up to 4 MB read window) | detected delimiter |
| `json_array` / `json_lines` | flattened key paths (depth ≤ 4) | record count | `[]` markers for list-typed paths |
| `json_doc` | flattened keys of the single object | — | note when a nested list was promoted |
| `log_lines` | per-template captured fields | line count | `log_templates[]` with synthesized regex, example, per-field distinct values |
| api (fetched URL) | same as the sniffed kind | — | note recording the fetch |

## Per-field profile keys

`name, detected_type (integer|number|boolean|datetime|string), python_type,
nullable, null_count, distinct, sample_values[≤8], min/max (numeric),
min_len/max_len (strings), enum_values (≤12 distinct), datetime_format,
regex (log captures), db_type/db_nullable (databases)`.

## Type inference order (delimited/JSON values)

int → number → boolean → datetime → string; **strings** with ≤12 distinct
values are additionally flagged `enum_values` (datetimes never are — a
Literal of observed timestamps breaks on the next day's data). Datetime
detection tries the formats listed in `DT_FORMATS` (ISO with/without tz,
slash-dates, `%d-%b-%Y`, syslog `%b %d %H:%M:%S`). For database sources, a
DB-declared `ENUM(...)` in `COLUMN_TYPE` replaces any sample-derived
candidates with the full declared value list (marked
`enum_source: "database ENUM declaration"`).

## Honest limits (say these out loud when reporting)

- Database stats come from the **sampled rows**, not a full scan; only the row
  count is exact. Aggregates generated later (min/max/avg probes) query the
  full table, so verification can catch sample/full-table drift.
- Databases with more than `--max-tables` tables (default 32) are truncated:
  the dropped table names are listed in the profile `notes` — read them
  before claiming full coverage.
- The 4 MB read window on delimited/JSON files caps very large flat files.
- Fetched URLs (`--source https://…`) are content-sniffed (JSON → JSONL →
  delimited → log); a body that matches none of those fails loudly instead of
  being mis-profiled.
- Log template synthesis is a simplified Drain-style approach: lines are
  grouped by token count, constant positions become literals, variable
  positions get shape-based named captures. Templates matching < 70% of their
  group are discarded. Highly irregular logs may produce zero templates — the
  profile then says so, and the source should be treated as unstructured text.
- Epoch-seconds timestamps stay "integer" by design (guessing epochs as dates
  corrupts ranges). Note them as a human.

## Interpreting the profile before modeling

- `nullable` everywhere on a column that "shouldn't" be → ask the user.
- Low-cardinality strings → becomes Literal in the model and an enum argument
  in the menu (the generator does both).
- String columns whose samples embed units (`NGN46494.89`, `38.2%`) → strip in
  a validator, or keep as strings and flag.
- JSON sources with list-typed paths (`items[]`) → the model covers the first
  element's shape; nested lists deeper than 4 levels are stringified.
