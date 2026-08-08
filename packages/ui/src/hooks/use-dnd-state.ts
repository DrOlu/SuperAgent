import { useDndContext } from '@dnd-kit/core'

interface DndState {
  /**  */
  isDragging: boolean
  /** ID */
  draggedId: string | number | null
  /** ID */
  overId: string | number | null
  /**  */
  isOver: boolean
}

/**
 *  dnd-kit 
 *
 * @returns 
 */
export function useDndState(): DndState {
  const { active, over } = useDndContext()

  return {
    isDragging: active !== null,
    draggedId: active?.id ?? null,
    overId: over?.id ?? null,
    isOver: over !== null
  }
}
