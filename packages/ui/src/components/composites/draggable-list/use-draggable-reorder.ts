// Original path: src/renderer/components/draggable-list/useDraggableReorder.ts
import type { DropResult } from '@hello-pangea/dnd'
import type { Key } from 'react'
import { useCallback, useMemo } from 'react'

interface UseDraggableReorderParams<T> {
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
 * @template T 
 * @param params - { originalList, filteredList, onUpdate, idKey }
 * @returns  DraggableVirtualList  props: { onDragEnd, itemKey }
 */
export function useDraggableReorder<T>({
  originalList,
  filteredList,
  onUpdate,
  itemKey
}: UseDraggableReorderParams<T>) {
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

  //  **  ** 
  const getItemKey = useCallback(
    (index: number): Key => {
      const item = filteredList[index]
      // item
      if (!item) return index

      const originalIndex = itemIndexMap.get(getId(item))
      return originalIndex ?? index
    },
    [filteredList, itemIndexMap, getId]
  )

  //  onDragEnd 
  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return

      //  getItemKey 
      const sourceOriginalIndex = getItemKey(result.source.index) as number
      const destOriginalIndex = getItemKey(result.destination.index) as number

      if (sourceOriginalIndex === destOriginalIndex) return

      // 
      const newList = [...originalList]
      const [movedItem] = newList.splice(sourceOriginalIndex, 1)
      newList.splice(destOriginalIndex, 0, movedItem)

      // 
      onUpdate(newList)
    },
    [originalList, onUpdate, getItemKey]
  )

  return { onDragEnd, itemKey: getItemKey }
}
