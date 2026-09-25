# neuralOS Python API

Verified against cactus-needle 3.0.2. Import surface: the `needle` package
exports `Needle`, `tool`, `Field`, `extract`, `ExtractionValidationError`,
`__version__`. (There is no `neuralOS` module — that is the product name only;
`import neuralOS` is always a `ModuleNotFoundError`.)

## Table of contents

1. Defining tools
2. The neuralOS agent: `neuralOS(...)` and `run()`
3. Response shapes
4. Constraints: `Field`, `Annotated`, enums, pydantic
5. Structured extraction: `extract()`
6. Embeddings: `embed()`
7. Constructor options and environment variables
8. Multi-call, grounding and validation semantics

## 1. Defining tools

```python
import needle

@needle.tool(triggers=["list databases", "show databases"])   # triggers recommended
def list_databases() -> dict:
    """One-line description of the action, phrased as a user would say it."""
    return {"databases": [...]}
```

**The decorator does NOT self-register.** A decorated function is inert until
you pass it to the agent — `needle.Needle(tools=[list_databases])` (or append
it to a `TOOLS` list you hand over). This is the single most common wiring
mistake: the script imports cleanly, the probe works when called directly, and
the agent simply never sees it. In generated or hand-written instance files,
append each tool to `TOOLS` immediately after its `def` —
`TOOLS.append(list_databases)`.

- The decorator inspects the signature for types and the docstring for the
  description. An `Args:` section documents parameters (Google-style):

```python
@needle.tool(triggers=["top customers", "best customers"])
def top_customers(limit: int = 10) -> dict:
    """List the top-spending customers.

    Args:
        limit: How many customers to return, e.g. 10.
    """
```

- Supported annotation types: `str`, `int`, `float`, `bool`, `list`, `dict`,
  `enum.Enum` subclasses, `typing.Literal[...]`, `Optional[X]` (makes the arg
  optional), `typing.Annotated[...]`, and pydantic `BaseModel` subclasses.
  Unknown annotations degrade to string.
- Default values make arguments optional; the model can still supply them
  from the request text ("top **10** customers" → `limit=10`).
- Tools can also be plain schema dicts (same JSON as `tools.json`) or
  pydantic models; pass any mix in `tools=[...]`.

## 2. The neuralOS agent

```python
agent = needle.Needle(tools=[tool_a, tool_b])   # or tools="… raw JSON string"
response = agent.run("what's it like in Lagos right now?")
```

`run(query, max_steps=8, max_new_tokens=512, strict=True)`:

1. Completes the query → the model returns `function_calls` (or none).
2. Executes every call **in-process** (`fn(**arguments)`); exceptions become
   `{"error": "<message>"}` results instead of crashing the loop.
3. Feeds `json.dumps(results)` verbatim back to the model, repeats while the
   model keeps calling tools, up to `max_steps`.
4. Returns the final response with `response["results"]` = every executed
   tool's return value, in order.

Key consequence: **what you return from a tool is the model's next prompt**.
Keep results small — see the digest+stash pattern in `tool-design.md`.

`neuralOS` is a context manager (`with needle.Needle(tools=[...]) as agent:`)
and should be `close()`d when done. Only one neuralOS instance per generation
is bound to the underlying engine at a time (module-level `_active`), so
create agents sequentially, not concurrently.

`agent.complete(text)` runs one completion without executing anything —
useful for inspecting what the model *would* call.
`agent.reset()` clears conversation state (seen years accumulate across
calls on one instance).

## 3. Response shapes

Turn response (also what `complete()` returns):

```json
{
  "type": "call" | "respond",
  "function_calls": [{"name": "top_customers", "arguments": {"limit": 10}}],
  "suppressed_calls": [],
  "reasoning": "User asked to list, so respond with the list.",
  "confidence": 0.53,
  "validation": {"ungrounded": [], "negation": false}
}
```

After `run()`, the final response additionally carries `results` (the list of
executed tool returns). Judge success by `results` being populated: the
final turn legitimately has `type: "respond"` and empty `function_calls`.
`confidence` comes from a calibrated head — treat it as a routing signal
(act / confirm / refuse), not a quality score. An off-topic request returns
an empty `function_calls` list rather than a guessed call.

## 4. Constraints

`needle.Field` (mirror of pydantic's, usable standalone):

```python
Field(default=10, description="How many", enum=["a", "b"], const="fixed",
      ge=1, le=100, gt=0, lt=10, multiple_of=5,
      min_length=1, max_length=80, pattern="^[a-z]+$", format="date",
      min_items=1, max_items=10, unique_items=True)
```

As a default value or via `Annotated`:

```python
from typing import Annotated

def top_customers(limit: Annotated[int, needle.Field(ge=1, le=100)] = 10) -> dict:
```

Prefer `Annotated[...] + plain default` over `Field` as the default value —
both produce the same schema, but `Annotated` keeps the real runtime default
if the model omits the argument. Constraints compile into the decode
grammar: a constrained value is *unrepresentable*, so the model cannot emit
it, which is far more reliable than hoping the 121M model behaves.

## 5. Structured extraction

```python
class Booking:
    """A restaurant booking."""
    # pydantic BaseModel or a plain dict schema work here

record = needle.extract(
    "table for 4 under Okafor, next Friday 7pm, +234 802 555 0100",
    Booking)
```

`extract(text, schema, system=None, max_new_tokens=512, weights=None,
strict=True, generation=None)` builds a one-shot neuralOS around the schema and
returns `schema(**arguments)` (pydantic) or the arguments dict. With
`strict=True`, temporal values contradicting a literal year in the input —
plus engine-reported fabricated or negated values — raise
`ExtractionValidationError` instead of returning silently. Return value is
`None` when nothing matched.

## 6. Embeddings

```python
agent = needle.Needle(tools=[])
vector = agent.embed("route this ticket to networking")   # list[float]
```

neuralOS 3 only (`generation=2` raises). Use for local search/matching/routing
— one model, no extra dependency.

## 7. Constructor options and environment

`needle.Needle(tools=None, system=None, weights=None, tool_index_path=None,
buffer_size=65536, auto_date=True, generation=None)`

- `system` — session facts (date, locale, device). With `auto_date=True`
  (default) a `date: YYYY-MM-DD HH:MM` fact is prepended unless the system
  text already has a date. That time-of-day component drifts between runs
  and can flip tool selection on a 121M model — pass a fixed `system=` with
  `auto_date=False` for reproducibility.
- `weights` — a fine-tuned `.cact` archive; the generation is read from the
  file's format tag. With tuned weights, `confidence` is reported as `None`
  (the calibration head is not updated by fine-tuning).
- `tool_index_path` — embeddings index over the tool set for retrieval when
  you have many tools; built on first use and reused when schemas match.
- `generation` — `2` (default legacy) vs `3`; plain `needle.Needle(...)`
  defaults to 3. `needle.Needle(tools=[...], generation=2)` runs neuralOS 2
  for existing deployments.
- Env: `NEEDLE3_LIB_PATH` (v3 engine library override), `NEEDLE_LIB_PATH`
  (legacy, v2 only), `NEEDLE_TELEMETRY=0` + `DO_NOT_TRACK=1` (telemetry
  off — set before import). Weights/engine cache:
  `~/.cache/cactus-needle/v{2,3}/<version>/`.

Fine-tuning your own tools (LoRA on the training checkpoint, then export):
see `cli.md` §finetune. Deploying the result with no Python at runtime:
see `engine-binary.md`.

## 8. Grounding and validation semantics

- Numeric argument values are checked against numbers **written in the
  query** (and system text): a `port=3306` the user never mentioned is
  flagged `ungrounded`. Write the numbers the model needs into the request,
  or give the argument a default.
- Date-formatted strings are checked against years present in the input plus
  the system date when the request reasons relatively ("tomorrow",
  "next week").
- Engine-reported `validation.ungrounded` entries turn into
  `{"error": "ungrounded <arg>"}` results under `strict=True` — the call is
  not executed. This is the mechanism that blocks secrets: a password the
  model cannot ground is refused rather than guessed.
- `suppressed_calls` lists calls the engine withheld (low confidence);
  `--forced` on the standalone engine disables that for benchmarking.
