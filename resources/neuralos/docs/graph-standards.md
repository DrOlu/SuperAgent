# Graph / relationship layer standards

Every neuralOS instance ships a relationship layer: the same parsed records
the probes already validate, projected as a property graph (nodes, directed
edges, properties, labels). The graph is **computed at fetch time, never
stored** — so it can never go stale, and live sources (aws, cloudflare)
rebuild it on every probe call.

## Why the semantics, not the database

The property-graph model (nodes, directed edges, properties, labels) is
adopted wholesale. **Index-free adjacency and graph databases are not
required** at instance scale (largest fleet instance: 135 records): an
in-memory adjacency dict over parsed records is equivalent and cannot drift
from the source. A graph database is only justified when an instance's
questions routinely need multi-hop traversal beyond what the bridge digests
serve — out of scope for generated instances.

## Phase 1 — relationship discovery (PROFILE extension)

Run `scripts/discover_relationships.py --profile profile.json --out
graph_edges.json` after profiling. **Discovery proposes; the runtime
verifies.** The proposer only emits NAME-based candidates (same normalized
keyish column across two tables, camelCase normalized); it never awards
tiers — samples (5 values/column) are far too small to prove or disprove a
join.

Tiers are awarded by `graph_bridge.py` over FULL record populations:

| Tier | Rule (runtime-awarded) | Meaning | Handling |
|---|---|---|---|
| `exact_fk` | >=5 shared values, and not a bare id<->id collision | Proven relationship | Trust; surface in graph probes |
| `candidate` | 1-4 shared values, OR bare `id`<->`id` surrogate collision (never promotes) | Guessed/coincidental link | Labelled low-confidence in every digest |
| `disjoint` | Shared name, ZERO overlap over FULL records | No join possible | **Must be reported, never silently dropped** |

Rules:

1. **Never fabricate an edge from a shared column name alone, and never from
   overlapping small-integer ranges.** The zinc-fraud corpus shipped an
   explicit "joins by account are impossible (0 key overlap)" note — that
   honesty is the standard. Disjoint findings are data-quality facts, quoted
   to the user.
2. **Cross-column joins are DISCOVERED at runtime** over full populations
   with two guardrails: tight containment (a child column's values >=80%
   contained in the parent's) and tight domain fit (parent domain <=3x the
   child's), plus a semantic guard (the child column's base name must relate
   to the parent TABLE, e.g. `scenario_id -> scenarios.id`). This is what
   kills small-integer numeric collisions (`albumid -> invoiceid` never
   passes). Schema-only FKs with unrelated names (SupportRepId ->
   EmployeeId) remain a known, documented gap.
3. **Edge properties** (the provenance record): source/target table+column,
   matching rule, tier, containment, matched-pair count, capped sample keys.
4. **Labels** derive from the table's enum-ish identity fields when present
   (`:Instance`, `:Zone`, `:Artist`, `:Scenario`), else the table name.
5. **Dangling-reference detection**: values in A with no match in B are
   counted as `dangling` — a data-quality signal surfaced in
   `graph_overview`, not an error.

## Phase 3 — the ≤3 graph probes (GENERATE contract)

Add AT MOST three graph probes to a menu (menu size is the binding
constraint for small-model selection; see instance-standards.md):

| Probe | Args | Returns |
|---|---|---|
| `*_graph_overview()` | none | node/edge counts per table, edge list w/ confidence, dangling counts, disjoint warnings; capped Mermaid rendering |
| `*_graph_neighbors(node)` | node id / name fragment (grammar-caged enum or pattern) | one-hop adjacency, capped, with edge properties |
| `*_graph_connect(a, b)` | two node fragments | path if any (bridge-traversed) or the honest `{"reachable": false, "why": ...}` |

Design rules:

1. **The model picks; the bridge traverses.** The 121M model cannot hop
   A→B→C. All traversal is a bridge function over parsed records.
2. **Triggers must be token-disjoint from the rest of the menu** and lean on
   the words "graph", "relationship", "linked", "connected".
3. **Neighbor/connect results carry the edge provenance** so the model (and
   the user) always knows if a link was `exact_fk` or `candidate`.
4. **Caps everywhere**: neighbors ≤ ROW_CAP nodes; overview Mermaid ≤ 30
   nodes; anything larger goes to a totals line, not a dump.
5. **Singleton tables get no graph probes.** A table with 1 row or no edges
   (aws `iam_users` n=1; outlook-mail's folder→messages tree) earns at most
   `graph_overview` — and sometimes nothing at all. Skipping graph probes
   for a source is a valid outcome, recorded in verification.txt.

## Phase 4 — graph verification gate (VERIFY extension)

On top of coverage / selection / truth:

1. **Edge truth**: for each `exact_fk` edge, the bridge-computed matched-pair
   count must equal a direct source query (SQL join count / API cross-list).
2. **Selection**: the three graph probes must pass 3 phrasings each, like any
   other probe — graph probes are new menu entries and can degrade existing
   selections. Re-run the FULL selection suite after adding them.
3. **Disjoint honesty check**: every `disjoint` edge in graph_edges.json must
   appear in a `graph_overview` digest. A graph that hides isolation is a
   bug, not a clean result.
4. **Dangling spot-check**: one dangling reference verified against the raw
   source (the referenced entity truly does not exist).

## Runtime notes

- Graph construction shares the parsed records already fetched — no extra
  source calls beyond what the probe needs. Build inside the existing
  fetchers; never a second pass over the network.
- `scripts/graph_bridge.py` is the reusable implementation: import it in a
  bridge, feed `table -> parsed_records`, get overview/neighbors/connect
  digests from `graph_edges.json` declarations.
- For ENGINE-runtime instances, the graph probes appear in
  needle_menu.json exactly like read probes; execution stays in the bridge.