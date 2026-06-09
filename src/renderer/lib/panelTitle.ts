// Make an agent/shell-derived tab title unique within a workspace. Some agents
// only surface their cwd (e.g. codex → the folder name), so two panels in the
// same directory compute the identical title ("Codex · cate"). Append the lowest
// " N" (N≥2) that no other panel is currently showing so duplicates stay
// distinguishable.
//
// Stability: each panel re-asserts its base title on every update and compares
// against siblings' *final* (already-numbered) titles. That keeps the numbering
// stable across the stream of OSC-title updates and lets it collapse back to the
// bare title once the bases diverge (e.g. one agent picks up a distinct task).
export function disambiguateTitle(
  base: string,
  panelId: string,
  panels: Record<string, { title: string }>,
): string {
  const taken = new Set<string>()
  for (const [id, p] of Object.entries(panels)) {
    if (id !== panelId) taken.add(p.title)
  }
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`
    if (!taken.has(candidate)) return candidate
  }
}
