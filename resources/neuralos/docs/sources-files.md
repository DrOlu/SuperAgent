# File sources — playbook

## Delimited (CSV/TSV/pipe/semicolon)
- Delimiter sniffed from the first 4 KB (csv.Sniffer, fallback comma).
- Profiler reads up to 4 MB; for bigger files profile a representative head
  slice (keep the header!), then let the generated bridge stream the full file.
- Ragged rows (fewer/more cells than the header) are zipped to the shortest —
  check `notes` and `null_count` spikes for evidence.
- Encoding is forced UTF-8 with replacement; mojibake in the profile means the
  source encoding differs — convert before generating.

## JSON / JSONL
- Objects are flattened with dot paths to depth 4; `items[]` marks lists.
- Mixed types across records for one path profile as `string` with a high
  distinct count — split the model or add a Union validator.
- JSONL lines that fail to parse are skipped silently — if record_count looks
  low, count the raw lines yourself and report the gap.

## Log files
- Template synthesis: group by token count → constant positions become
  literals → variables get shape-based names (timestamp, ip, level, num_N,
  var_N) and typed regex captures.
- Multiple templates are normal (one per line shape); the generated model has
  one class per template plus `parse_line()` that tries them in frequency order.
- Unparsed lines are counted, never dropped silently — coverage tells you.
- Rotate-safe: profiling sees the current file; for rotated sets, profile a
  concatenation sample so rare shapes are not missed.

## Spreadsheets
- First sheet, values-only, first 20k rows, empty cells → null. Multi-sheet
  books: profile each sheet (rename copies to .xlsx.sniff.csv is automatic).

## Databases and APIs
See sources-databases.md and sources-apis.md.
