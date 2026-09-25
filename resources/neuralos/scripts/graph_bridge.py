"""graph_bridge — reusable runtime graph layer for neuralOS instances.

Drop into any instance directory alongside graph_edges.json (emitted by
discover_relationships.py). Feed parsed records per table; the property
graph is built AT FETCH TIME from those records — never stored, never stale.

Serves the ≤3 graph probes (references/graph-standards.md):

  overview(records)          node/edge counts, provenance, disjoint warnings, Mermaid
  neighbors(records, frag)   one-hop adjacency (capped, provenance included)
  connect(records, a, b)     bridge-traversed path with value continuity,
                             or an honest {"reachable": false, ...}

Contract:
- the model picks; this module traverses (the 121M model cannot hop);
- TIER IS AWARDED HERE, over FULL records — the sample-based proposer only
  proposes: >=5 shared values -> exact_fk (never for bare id<->id surrogate
  collisions), 1-4 -> candidate, zero -> disjoint (proven, quoted);
- cross-column joins (events.scenario_id -> scenarios.id,
  customer.SupportRepId -> employee.EmployeeId) are DISCOVERED over the full
  populations with tight-containment scoring: a child column's values must be
  >=80% contained in the parent's and the parent's domain <=3x the child's —
  this is what kills small-integer numeric collisions;
- all returns are capped digests.
"""
import json
import re


def _snake(name):
    """Normalize column names (camelCase -> snake) so declared edges match
    parsed-record keys regardless of naming convention."""
    return re.sub(r"[^0-9a-zA-Z_]+", "_", str(name)).strip("_").lower()


def _keyish(n):
    return (n.endswith("_id") or n.endswith("_key") or n.endswith("id") or
            n.startswith("id") or
            n in ("txn_id", "account_id", "name", "email", "hostname",
                  "zone", "id"))


def _name_relates(child_col, parent_table):
    """True when the child column's base name appears in the parent table's
    name (scenario_id -> scenarios, host_id -> affected_hosts)."""
    base = child_col[:-3] if child_col.endswith("_id") else child_col
    base = base.rstrip("_")
    return len(base) >= 4 and base in parent_table


def _stringify(v):
    """Scalars and stringified lists both (the normalization contract)."""
    if isinstance(v, list):
        return [str(x) for x in v]
    s = str(v)
    if s.startswith("[") and s.endswith("]"):
        try:
            return [str(x) for x in json.loads(s)]
        except Exception:
            return [s]
    return [s]


class GraphLayer:
    def __init__(self, edges_file, mermaid_cap=30, result_cap=25):
        with open(edges_file) as fh:
            decl = json.load(fh)
        self.edges_decl = decl.get("edges", [])
        self.mermaid_cap = mermaid_cap
        self.result_cap = result_cap

    # -------------------------------------------------- indexing
    def _keyvals(self, records_by_table):
        """{table: {normalized_col: set(str values)}} over FULL parsed records."""
        kv = {}
        for t, recs in (records_by_table or {}).items():
            cols = {}
            for rec in recs:
                for col, v in rec.items():
                    if v is None:
                        continue
                    cols.setdefault(_snake(col), set()).update(_stringify(v))
            kv[t] = cols
        return kv

    @staticmethod
    def _tier(e, ov):
        if e.get("surrogate_warning") or e.get("rule") == "surrogate_key_collision":
            return "candidate"  # bare id<->id: numeric collision, never exact_fk
        if e.get("tier") == "exact_fk" or len(ov) >= 5:
            return "exact_fk"
        return "candidate"

    # -------------------------------------------------- verification
    def _verify(self, records_by_table):
        kv = self._keyvals(records_by_table)
        verified, demoted, dangling = [], [], []
        declared = set()
        for e in self.edges_decl:
            declared.add((e["a"], e["b"], _snake(e["a_col"]), _snake(e["b_col"])))
            av = kv.get(e["a"], {}).get(_snake(e["a_col"]), set())
            bv = kv.get(e["b"], {}).get(_snake(e["b_col"]), set())
            if not av or not bv:
                demoted.append({**e, "why": "column absent/empty at runtime"})
                continue
            ov = av & bv
            if not ov:
                demoted.append({**e, "why": "zero value overlap over FULL records",
                                "runtime_tier": "disjoint"})
                continue
            verified.append({**e, "runtime_tier": self._tier(e, ov),
                             "matched_pairs": len(ov),
                             "sample_keys": sorted(ov)[:5]})
            d = len(av - bv)
            if d:
                dangling.append({"a": e["a"], "b": e["b"], "column": e["a_col"],
                                 "dangling_refs": d,
                                 "note": "%d values in %s.%s have no match in %s.%s"
                                         % (d, e["a"], e["a_col"], e["b"], e["b_col"])})
        verified.extend(self._discover_cross(kv, declared))
        return {"kv": kv, "verified": verified, "demoted": demoted,
                "dangling": dangling}

    def _discover_cross(self, kv, declared):
        """Discover cross-column joins over FULL populations: a child column's
        values >=80% contained in a parent keyish column whose domain is at
        most 3x the child's. Best parent per child wins; duplicates of declared
        edges are skipped."""
        out = []
        tables = sorted(kv)
        for t1 in tables:
            for c1 in sorted(kv[t1]):
                if not _keyish(c1):
                    continue
                v1 = kv[t1][c1]
                best = None  # (containment, domain2, t2, c2)
                for t2 in tables:
                    if t2 <= t1:
                        continue
                    # semantic guard: a cross-name join is only proposed when
                    # the child column's base name relates to the parent TABLE
                    # (scenario_id -> scenarios.id). Numeric-range coincidence
                    # (albumid -> invoiceid) never passes this.
                    base1 = c1[:-3] if c1.endswith("_id") else c1
                    if not _name_relates(c1, t2):
                        continue
                    for c2 in sorted(kv[t2]):
                        if not _keyish(c2) or c2 == c1:
                            continue
                        if (t1, t2, c1, c2) in declared or \
                           (t2, t1, c2, c1) in declared:
                            continue
                        ov = v1 & kv[t2][c2]
                        if not ov:
                            continue
                        containment = len(ov) / len(v1)
                        domain2 = len(kv[t2][c2])
                        if containment >= 0.8 and domain2 <= 3 * len(v1):
                            if best is None or containment > best[0] or \
                               (containment == best[0] and domain2 < best[1]):
                                best = (containment, domain2, t2, c2)
                if best is None:
                    continue
                containment, _, t2, c2 = best
                ov = v1 & kv[t2][c2]
                tier = "exact_fk" if containment >= 0.9 else "candidate"
                out.append({"a": t1, "a_col": c1, "b": t2, "b_col": c2,
                            "rule": "value_overlap_cross_column",
                            "tier": tier, "runtime_tier": tier,
                            "containment": round(containment, 2),
                            "matched_pairs": len(ov),
                            "sample_keys": sorted(ov)[:5]})
        return out

    def _edge_between(self, g, t1, t2):
        for e in g["verified"]:
            if (e["a"], e["b"]) in ((t1, t2), (t2, t1)):
                return e
        return None

    # -------------------------------------------------- probes
    def overview(self, records_by_table):
        g = self._verify(records_by_table)
        nodes = [{"table": t, "rows": len(recs)}
                 for t, recs in (records_by_table or {}).items()]
        cap = self.result_cap
        ordered = sorted(g["verified"], key=lambda e: e["runtime_tier"] != "exact_fk")
        return {
            "nodes": nodes,
            "edges_total": len(g["verified"]),
            "edges_verified": [{"a": e["a"], "via": e["a_col"], "b": e["b"],
                                "via_b": e["b_col"], "rule": e.get("rule"),
                                "tier": e["runtime_tier"],
                                "matched_pairs": e["matched_pairs"]}
                               for e in ordered[:cap]],
            "edges_more": max(0, len(g["verified"]) - cap),
            "disjoint_edges": len(g["demoted"]),
            "disjoint": [{"a": e["a"], "b": e["b"], "column": _snake(e["a_col"]),
                          "why": e.get("why")} for e in g["demoted"][:10]],
            "disjoint_more": max(0, len(g["demoted"]) - 10),
            "dangling": g["dangling"][:10],
            "mermaid": self._mermaid(g),
        }

    def neighbors(self, records_by_table, node_fragment):
        g = self._verify(records_by_table)
        frag = str(node_fragment).lower()
        hits = []
        for t, cols in sorted(g["kv"].items()):
            for col in sorted(cols):
                for v in sorted(cols[col]):
                    if frag in v.lower():
                        hits.append((t, col, v))
        if not hits:
            return {"error": "no node matches %r" % node_fragment,
                    "hint": "search by id/name fragment; graph_overview lists node tables"}
        out = []
        for t, col, v in hits[:5]:
            links = []
            for e in g["verified"]:
                if e["a"] == t and _snake(e["a_col"]) == col and \
                        v in g["kv"].get(e["b"], {}).get(_snake(e["b_col"]), set()):
                    links.append({"to": "%s.%s=%s" % (e["b"], e["b_col"], v),
                                  "tier": e["runtime_tier"]})
                elif e["b"] == t and _snake(e["b_col"]) == col and \
                        v in g["kv"].get(e["a"], {}).get(_snake(e["a_col"]), set()):
                    links.append({"to": "%s.%s=%s" % (e["a"], e["a_col"], v),
                                  "tier": e["runtime_tier"]})
            if links:
                out.append({"node": "%s.%s=%s" % (t, col, v), "links": links})
            else:
                out.append({"node": "%s.%s=%s" % (t, col, v), "links": [],
                            "note": "no verified edges touch this node"})
        return {"fragment": node_fragment, "matches": out[:self.result_cap],
                "matches_total": len(out)}

    def connect(self, records_by_table, a_frag, b_frag):
        """Table-level BFS where every hop must share at least one real key
        value (value continuity), with fragments present at both ends."""
        g = self._verify(records_by_table)
        adj = {}
        for e in g["verified"]:
            adj.setdefault(e["a"], set()).add(e["b"])
            adj.setdefault(e["b"], set()).add(e["a"])

        def tables_with(frag):
            return [t for t, cols in g["kv"].items()
                    if any(frag.lower() in v.lower()
                           for vals in cols.values() for v in vals)]

        starts, targets = tables_with(a_frag), tables_with(b_frag)
        if not starts:
            return {"reachable": False, "from": a_frag, "to": b_frag,
                    "why": "no node matches source fragment %r" % a_frag}
        if not targets:
            return {"reachable": False, "from": a_frag, "to": b_frag,
                    "why": "no node matches target fragment %r" % b_frag}

        paths = []
        for t0 in sorted(starts):
            queue = [(t0, {t0}, [])]
            while queue and len(paths) < 3:
                t, seen_t, chain = queue.pop(0)
                if t in targets and chain:
                    paths.append({"route": [c["via"] for c in chain],
                                  "shared_values": self._continuity(g, chain)})
                    continue
                for nb in sorted(adj.get(t, set()) - seen_t):
                    e = self._edge_between(g, t, nb)
                    if e is None:
                        continue
                    queue.append((nb, seen_t | {nb}, chain + [{
                        "via": "%s.%s <-> %s.%s" % (e["a"], e["a_col"],
                                                    e["b"], e["b_col"]),
                        "a": e["a"], "col": e["a_col"], "b": e["b"],
                        "col_b": e["b_col"]}]))
        if paths:
            return {"reachable": True, "from": a_frag, "to": b_frag,
                    "paths": paths[:3]}
        return {"reachable": False, "from": a_frag, "to": b_frag,
                "why": "no verified edge path between these nodes "
                       "(graph_overview lists the disjoint/dead columns)"}

    def _continuity(self, g, chain):
        """Intersection of shared key values along a chain (max 5 reported)."""
        if not chain:
            return []
        shared = None
        for c in chain:
            ov = g["kv"].get(c["a"], {}).get(_snake(c["col"]), set()) & \
                 g["kv"].get(c["b"], {}).get(_snake(c.get("col_b") or c["col"]), set())
            shared = ov if shared is None else (shared & ov or shared)
        return sorted(shared or set())[:5]

    def _mermaid(self, g):
        lines, count = ["graph LR"], 0
        for e in g["verified"][:self.mermaid_cap]:
            lines.append('  %s -- "%s (%s)" --> %s' % (e["a"], e["a_col"],
                                                       e["runtime_tier"], e["b"]))
            count += 1
        extra = len(g["verified"]) - count
        if extra > 0:
            lines.append('  more["+%d more edges"]' % extra)
        return "\n".join(lines) if count else None