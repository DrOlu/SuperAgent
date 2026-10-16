# Database sources — playbook

## Access
- mysql://, postgres://, and other DSNs go through the `usql` CLI with CSV
  output (verified pattern); sqlite DSNs use the stdlib sqlite3 module.
- The DSN is baked into the generated bridge (or read from the --dsn-env var).
  It never appears in the menu, and the probes take table/column names that are
  whitelisted against the profile.

## Profiling queries (MySQL dialect)
- Tables: information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE().
- Columns: information_schema.COLUMNS (name, data_type, column_type,
  is_nullable) ordered by ordinal position.
- Row count: exact COUNT(*) per profiled table.
- Sample: `SELECT * FROM <t> ORDER BY 1 DESC LIMIT <n>` (newest first when the
  PK is monotonic — say so when it isn't).

## Generated probes
- `<t>_count` — exact COUNT(*).
- `<t>_recent(limit)` — newest rows, parsed through the model, capped at 25.
- `<t>_summary` — row count + MIN/MAX/AVG for every numeric column (full-table
  aggregates; this is the truth-check oracle).
- `<t>_by_<enum_column>(value)` — filtered count + capped rows; the value is an
  enum argument covering only values observed in the data.

## Limits and gotchas
- Databases are profiled up to `--max-tables` tables (default 32); dropped
  tables are named in the profile notes — pass --table / re-run for any of
  them before claiming full coverage.
- Column stats come from the sample (say it); full-table aggregates come from
  the summary probe (exact).
- DB-declared ENUM columns are modeled from the DDL's complete value list,
  not the sample.
- Backtick-quoted identifiers everywhere; identifiers are whitelisted, values
  are enum-constrained — the two injection surfaces are closed.
- Views appear in information_schema like tables; profiling them is fine, but
  COUNT(*) on heavy views can be slow — profile selectively.
- Other engines (Oracle, SQL Server): profile via usql DSN; information_schema
  queries may need dialect tweaks — check usql output before generating.
