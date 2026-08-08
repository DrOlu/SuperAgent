/**
 *  dnd ""
 * @template {T} 
 * @param {T[]} list 
 * @param {number} sourceIndex 
 * @param {number} destIndex 
 * @param {number} [len=1]  1
 * @returns {T[]} 
 */
export function droppableReorder<T>(list: T[], sourceIndex: number, destIndex: number, len: number = 1): T[] {
  const result = Array.from(list)
  const removed = result.splice(sourceIndex, len)

  if (sourceIndex < destIndex) {
    result.splice(destIndex - len + 1, 0, ...removed)
  } else {
    result.splice(destIndex, 0, ...removed)
  }
  return result
}
