# Pydantic model standards (v2)

## Non-negotiables in generated models

- `model_config = ConfigDict(extra="forbid", populate_by_name=True,
  str_strip_whitespace=True)` — unknown columns are errors, not surprises.
- **Every field whose source key differs from its Python identifier carries
  `Field(alias="<exact source key>")`.** Rows arrive keyed by the source's own
  names (DB column `InvoiceDate`, CSV header `First Name`, JSON path
  `items[].id`) — without the alias, `model(**row)` fails on the first record
  and coverage reads 0%. This is the #1 generated-model failure; the generator
  now emits aliases automatically, keep them when editing.
- One class per table / record shape, PascalCase from the table name
  (suffixed on collision).
- Every field carries a `description` with its observed statistics
  (type, db type, min/max, null counts, example values).
- `Optional[...] = None` exactly where nulls were observed — nowhere else
  (for database sources, `db_nullable` counts: a column the DDL marks
  nullable is Optional even when the sample happened to contain no nulls).
- datetime fields are annotated `datetime` with a `field_validator(mode="before")`
  that tries every datetime format the profiler saw, then rejects. **A
  datetime field is never a `Literal`** — a Literal of observed dates/timestamps
  rejects every value from the next day, silently corrupting coverage.

## Type mapping

| Profile detected_type | Python annotation | Constraints added |
|---|---|---|
| integer | `int` | `ge=min, le=max` |
| number | `float` | `ge=min, le=max` |
| boolean | `bool` | — |
| datetime | `datetime` | before-validator over DT_FORMATS — never Literal |
| DB-declared ENUM | `Literal[...]` from the DDL | authoritative, complete vocabulary |
| string (≤12 distinct) | `Literal["a", "b", …]` | sample-derived — confirm the full domain before trusting |
| string | `str` | `min_length, max_length` |
| log capture | `str` | `pattern` from the template regex |
| nullable variant | `Optional[X] = None` | same constraints |

**Enum precedence:** a database `ENUM(...)` declaration beats the sample —
the DDL lists every legal value, the sample only lists the ones that
appeared. When both exist, the generator uses the DDL and the field
description says so. A sample-derived Literal is a hypothesis: a status
column sampled on 20 rows may have unseen legal values that will then fail
validation — widen it (or verify against a full `SELECT DISTINCT`) before
shipping.

## Editing rules (the model is a draft you finalize)

- Rename cryptic columns in the model, not in the bridge — keep one source of
  truth for field names per layer.
- Promote string columns to domain Enums when the user supplies labels
  (e.g. Status 0–6 → New/Assigned/…); keep the raw value in a validator.
- `extra="forbid"` may be relaxed to `"ignore"` for sources that append new
  columns routinely — note the decision in the class docstring.
- Money is `decimal.Decimal` with a validator when precision matters; the
  generator emits float, which is fine for counts and dashboards only.

## Verification hook

The generator's `bridge` counts every parse into `_VALIDATION`
(parsed/failed/errors[≤5]). Coverage below ~95% means: sample missed dirty
rows, constraints are too tight, or the source mutates. Fix the model, not the
data — and re-run Phase 4.
