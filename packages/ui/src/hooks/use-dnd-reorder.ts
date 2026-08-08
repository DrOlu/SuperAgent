import type { Key } from 'react'
import { useCallback, useMemo } from 'react'

import { reorderVisibleSubset } from '../components/composites/reorderable-list/reorder-visible-subset'

interface UseDndReorderParams<T> {
  /**  */
  originalList: T[]
  /**  */
  filteredList: T[]
  /**  */
  onUpdate: (newList: T[]) => void
  /** ID */
  itemKey: keyof T | ((item: T) => Key)
}

/**
 * """"
 *
 *  {@link reorderVisibleSubset} UI 
 *  `{ oldIndex, newIndex }`  +  `useMemo` /
 * `useCallback`  `itemKey(index)` 
 *  PR #14631 review #4287764522 (S9) 
 *
 * @template T 
 * @param params - { originalList, filteredList, onUpdate, itemKey }
 * @returns  Sortable  onSortEnd 
 */
export function useDndReorder<T>({ originalList, filteredList, onUpdate, itemKey }: UseDndReorderParams<T>) {
  const getId = useCallback(
    (item: T) => (typeof itemKey === 'function' ? itemKey(item) : (item[itemKey] as Key)),
    [itemKey]
  )

  //  item ID  ** 
  const itemIndexMap = useMemo(() => {
    const map = new Map<Key, number>()
    originalList.forEach((item, index) => {
      map.set(getId(item), index)
    })
    return map
  }, [originalList, getId])

  //  **  ** itemKey 
  const getItemKey = useCallback(
    (index: number): Key => {
      const item = filteredList[index]
      if (!item) return index

      const originalIndex = itemIndexMap.get(getId(item))
      return originalIndex ?? index
    },
    [filteredList, itemIndexMap, getId]
  )

  //  reorderVisibleSubset
  const onSortEnd = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      const nextList = reorderVisibleSubset({
        items: originalList,
        visibleItems: filteredList,
        fromIndex: oldIndex,
        toIndex: newIndex,
        getId: (item) => getId(item) as string | number
      })

      if (nextList !== originalList) {
        onUpdate(nextList)
      }
    },
    [filteredList, getId, onUpdate, originalList]
  )

  return { onSortEnd, itemKey: getItemKey }
}
