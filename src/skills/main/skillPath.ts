/** Split a bundle-relative file path, rejecting paths that can escape its root. */
export function skillPathSegments(relPath: string): string[] {
  const segments = relPath.split(/[\\/]/)
  const isAbsolute = /^[\\/]/.test(relPath) || /^[a-zA-Z]:[\\/]/.test(relPath)
  if (isAbsolute || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe skill file path: ${relPath}`)
  }
  return segments
}
