# REST API sources — playbook

## Profiling
- `--source https://…` fetches once (4 MB cap) and sniffs the body as JSON,
  CSV, or text, then profiles accordingly. Auth is NOT handled by the profiler
  — profile a URL that returns sample data without secrets, or curl it to a
  file first and profile the file.

## Generating the instance
- The generated bridge gets one retrieval function per resource endpoint; bake
  auth into it (env lookup preferred over constants for anything sensitive).
- Pagination: if the sample shows `next` links or offset params, generate the
  probe with a page/offset argument (pattern-constrained integer) and aggregate
  client-side up to a row cap.
- Rate limits: probes sleep or back off inside the bridge; the model never
  knows about them.

## Field notes
- API payloads flatten like JSON sources; `data.items[]` shapes are common —
  the model covers the item shape.
- IDs that profile as integers may still be non-numeric upstream (string IDs);
  keep them strings when in doubt.
- Envelope keys (status, meta) are profiled as fields — usually you exclude
  them from the model and keep them in the bridge.

## Verification
Coverage runs over the fetched sample; also compare a relayed count against a
second, direct request (APIs change under you more than files do).
