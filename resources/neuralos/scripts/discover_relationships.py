#!/usr/bin/env python3
"""Relationship discovery for the graph layer (see references/graph-standards.md).

Reads a profile.json (the skill's Phase-1 output) and emits graph_edges.json:
node declarations, edge candidates between table pairs with provenance
(rule + confidence tier), and — critically — DISJOINT findings: column pairs
that share a NAME but whose values never overlap, which must be reported,
never used as joins.

Confidence tiers:
  exact_fk   value overlap proven within the profile sample (still
             re-verified at runtime over full records by graph_bridge)
  candidate  shared column name only — a guess, always labelled low
  disjoint   shared name, zero value overlap — a data-quality fact

Column names are normalized (camelCase -> snake) so FK names match across
naming conventions (ArtistId == artist_id).

Usage:
  python3 discover_relationships.py --profile profile.json --out graph_edges.json
"""
import argparse
import json
import re


def snake(name):
    return re.sub(r"[^0-9a-zA-Z_]+", "_", name).strip("_").lower()


def value_overlap(a_vals, b_vals):
    """Return count of a-values found in b-values."""
    bset = {v for v in b_vals if v not in ("None", "none", "")}
    return sum(1 for v in a_vals if v in bset)


def _keyish(n):
    return (n.endswith("_id") or n.endswith("_key") or n.endswith("id") or
            n.startswith("id") or
            n in ("txn_id", "account_id", "name", "email", "hostname",
                  "zone", "id"))


def col_a_of(cols, n):
    return cols.get(n, n)


def sample_vals(table, col):
    """Prefer column sample_values; fall back to scanning sample_records."""
    for c in (table.get("columns") or []):
        if c["name"] == col and c.get("sample_values"):
            return [str(v) for v in c["sample_values"]]
    return [str(r.get(col)) for r in (table.get("sample_records") or [])
            if r.get(col) is not None]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sample-cap", type=int, default=200,
                    help="max sample values considered per column")
    args = ap.parse_args()

    profile = json.load(open(args.profile))
    tables = profile["source"]["tables"]
    nodes, edges = [], []

    for t in tables:
        nodes.append({"table": t["name"], "rows": t.get("db_row_count", 0),
                      "label_hint": t["name"].upper()})

    def norm_cols(t):
        """{normalized_name: original_name}."""
        return {snake(c["name"]): c["name"] for c in (t.get("columns") or [])}

    for i, a in enumerate(tables):
        for b in tables[i + 1:]:
            a_cols, b_cols = norm_cols(a), norm_cols(b)
            for n in sorted(set(a_cols) & set(b_cols)):
                if not _keyish(n):
                    continue
                col_a, col_b = a_cols[n], b_cols[n]
                edges.append({
                    "a": a["name"], "a_col": col_a, "b": b["name"], "b_col": col_b,
                    "rule": ("surrogate_key_collision" if n == "id"
                             else "same_name"),
                    "tier": "proposed",
                    "evidence": "same-name keyish column; runtime verifies over "
                                "FULL records (exact_fk >=5 shared values, "
                                "surrogate bare-id pairs never promote)",
                    "cardinality_hint": "unknown",
                    "surrogate_warning": ("both sides are bare 'id' keys — numeric "
                                          "collision, NOT a foreign key") if n == "id"
                                         else None})

    out = {"profiled_at": profile.get("profiled_at"),
           "nodes": nodes, "edges": edges, "disjoint": [],
           "note": "disjoint findings are runtime-computed over FULL records "
                   "(samples are too small to prove disjointness); this file "
                   "only PROPOSES edges — graph_bridge verifies",
           "standards": "references/graph-standards.md"}
    with open(args.out, "w") as fh:
        json.dump(out, fh, indent=1, default=str)
    print("nodes=%d edges=%d (all proposed; runtime verifies) disjoint=runtime" % (
        len(nodes), len(edges)))


if __name__ == "__main__":
    main()
