// Re-export from shared — the implementation moved to src/shared/collectPanelIds
// so the main process (window registry) can reuse the same dock-layout walk.
// Renderer call sites keep importing from here unchanged.
export { collectPanelIds } from '../../../shared/collectPanelIds'
