// =============================================================================
// jsonUtils — the canonical guard for validating a JSON.parse result as a plain
// object. The check `v && typeof v === 'object' && !Array.isArray(v)` was copied
// across every JSON-backed store (settings, ui-state, boot snapshot, workspace
// state, SSH stores, auth.json). This is the one place it lives now.
// =============================================================================

/** True if `v` is a non-null, non-array object (a plain JSON object). Narrows
 *  `v` to `Record<string, unknown>` so callers can index it without a cast. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** `v` as a plain object, or null if it is not one. For call sites that want a
 *  null fallback; sites wanting an empty-object fallback use
 *  `isPlainObject(v) ? v : {}` directly. */
export function asObject(v: unknown): Record<string, unknown> | null {
  return isPlainObject(v) ? v : null
}
