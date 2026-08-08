// https://github.com/Gudahtt/prettier-plugin-sort-json/blob/main/src/index.ts
/**
 * Lexical sort function for strings, meant to be used as the sort
 * function for `Array.prototype.sort`.
 *
 * @param a - First element to compare.
 * @param b - Second element to compare.
 * @returns A number indicating which element should come first.
 */
function lexicalSort(a: string, b: string): number {
  if (a > b) {
    return 1
  }
  if (a < b) {
    return -1
  }
  return 0
}

/**
 * 
 * @param obj 
 * @returns 
 */
export function sortedObjectByKeys(obj: object): object {
  const sortedKeys = Object.keys(obj).sort(lexicalSort)

  const sortedObj = {}
  for (const key of sortedKeys) {
    let value = obj[key]
    // 
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      value = sortedObjectByKeys(value)
    }
    sortedObj[key] = value
  }

  return sortedObj
}
