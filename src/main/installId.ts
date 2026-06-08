// =============================================================================
// Install ID — random, anonymous identifier persisted in userData. Used to
// roughly deduplicate event volume per install. No PII derivation: it is not
// hashed from hardware, hostname, or anything user-attributable.
// =============================================================================

import crypto from 'crypto'
import { readTextFile, writeTextFile } from './jsonFileStore'

const FILENAME = 'install-id'
let cached: string | null = null

export function getInstallId(): string {
  if (cached) return cached
  const raw = readTextFile(FILENAME)?.trim()
  if (raw && /^[0-9a-f-]{36}$/i.test(raw)) {
    cached = raw
    return cached
  }
  const id = crypto.randomUUID()
  writeTextFile(FILENAME, id)
  cached = id
  return id
}
