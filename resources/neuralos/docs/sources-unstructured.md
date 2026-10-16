# Unstructured text — playbook

Unstructured sources (emails, invoices, incident narratives, free-text fields)
have no columns to profile — but the runtime's structured-extraction capability
pairs them with the Pydantic model you generate anyway.

## Approach

1. **Model first**: build the Pydantic model from a PROFILE of the structured
   companion data (the tickets table behind the narratives), or hand-design it
   with the user from what the text should contain. The model is the contract.
2. **Extraction bridge**: the generated bridge gains one probe —
   `extract_record(text)` — that runs the on-device model's extraction with the
   Pydantic schema: messy text in, typed validated record out, offline.
3. **Batch**: `extract_all(file)` reads the file, extracts per record/paragraph,
   and reports parse coverage through `_VALIDATION` like every other source.

## Rules

- Extraction confidence is lower than tool-calling: keep `extra="forbid"` on
  the model so malformed records fail loudly instead of half-parsing.
- Required-vs-optional fields come from how often the information actually
  appears in a hand-read sample — read 10 examples yourself first.
- Dates, amounts and IDs extracted from prose get validators (the model's
  grounding rejects invented values; your validators reject misformatted ones).
- Always show the user the extracted record alongside the raw text for the
  first batch — extraction is the one place where "valid" does not mean
  "correct".

## Combining with structured sources

The strongest instances join both: structured rows for counts and trends, plus
an extraction probe for the free-text fields the rows point at (ticket
narratives, log payloads). The menu carries both probe sets with disjoint
triggers.
