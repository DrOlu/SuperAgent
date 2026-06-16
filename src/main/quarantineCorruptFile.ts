// =============================================================================
// quarantineCorruptFile — copy an unparseable state file aside as
// `<file>.corrupt-<timestamp>` before falling back to defaults, so a corrupt
// hand-edit or crash-mid-write is preserved for recovery instead of silently
// ignored or overwritten. Shared by every JSON-backed store (jsonStateFile,
// jsonFileStore, grantedPathStore, projectWorkspaceStore) so corrupt-file
// handling is consistent across them.
// =============================================================================

import fs from 'fs'

/** Copy `filePath` aside as `<filePath>.corrupt-<ts>`. Returns the backup path,
 *  or null when the copy failed (e.g. the file vanished). Never throws. */
export function quarantineCorruptFile(filePath: string): string | null {
  try {
    const backup = `${filePath}.corrupt-${Date.now()}`
    fs.copyFileSync(filePath, backup)
    return backup
  } catch {
    return null
  }
}
