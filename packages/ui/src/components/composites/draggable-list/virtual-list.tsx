import type {
  DroppableProps,
  DropResult,
  OnDragEndResponder,
  OnDragStartResponder,
  ResponderProvided
} from '@hello-pangea/dnd'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { type ScrollToOptions, useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { type Key, memo, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

import Scrollbar from '../scrollbar'
import { droppableReorder } from './sort'

export interface DraggableVirtualListRef {
  measure: () => void
  scrollElement: () => HTMLDivElement | null
  scrollToOffset: (offset: number, options?: ScrollToOptions) => void
  scrollToIndex: (index: number, options?: ScrollToOptions) => void
  resizeItem: (index: number, size: number) => void
  getTotalSize: () => number
  getVirtualItems: () => VirtualItem[]
  getVirtualIndexes: () => number[]
}

/**
 *  Props DraggableVirtualList
 *
 * @template T 
 * @property {string} [className]  class
 * @property {React.CSSProperties} [style] 
 * @property {React.CSSProperties} [itemStyle] 
 * @property {React.CSSProperties} [itemContainerStyle] 
 * @property {Partial<DroppableProps>} [droppableProps]  Droppable 
 * @property {(list: T[]) => void} [onUpdate]  useDraggableReorder 
 * @property {OnDragStartResponder} [onDragStart] 
 * @property {OnDragEndResponder}   [onDragEnd] 
 * @property {T[]} list 
 * @property {(index: number) => Key} [itemKey]  key index
 * @property {number} [overscan=5] 
 * @property {React.ReactNode} [header] 
 * @property {(item: T, index: number) => React.ReactNode} children 
 */
export interface DraggableVirtualListProps<T> {
  ref?: React.Ref<DraggableVirtualListRef>
  className?: string
  style?: React.CSSProperties
  scrollerStyle?: React.CSSProperties
  itemStyle?: React.CSSProperties
  itemContainerStyle?: React.CSSProperties
  droppableProps?: Partial<DroppableProps>
  onUpdate?: (list: T[]) => void
  onDragStart?: OnDragStartResponder
  onDragEnd?: OnDragEndResponder
  list: T[]
  itemKey?: (index: number) => Key
  estimateSize?: (index: number) => number
  overscan?: number
  header?: React.ReactNode
  children: (item: T, index: number) => React.ReactNode
  disabled?: boolean
}

/**
 * 
 * - 
 * @template T 
 * @param {DraggableVirtualListProps<T>} props 
 * @returns {React.ReactElement}
 */
function DraggableVirtualList<T>({
  ref,
  className,
  style,
  scrollerStyle,
  itemStyle,
  itemContainerStyle,
  droppableProps,
  onDragStart,
  onUpdate,
  onDragEnd,
  list,
  itemKey,
  estimateSize: _estimateSize,
  overscan = 5,
  header,
  children,
  disabled
}: DraggableVirtualListProps<T>): React.ReactElement {
  const _onDragEnd = (result: DropResult, provided: ResponderProvided) => {
    onDragEnd?.(result, provided)
    if (onUpdate && result.destination) {
      const sourceIndex = result.source.index
      const destIndex = result.destination.index
      if (sourceIndex !== destIndex) {
        const reorderAgents = droppableReorder(list, sourceIndex, destIndex)
        onUpdate(reorderAgents)
      }
    }
  }

  //  ref
  const parentRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const droppableInnerRef = useRef<((element: HTMLElement | null) => void) | null>(null)

  const virtualizer = useVirtualizer({
    count: list?.length ?? 0,
    getScrollElement: useCallback(() => parentRef.current, []),
    getItemKey: itemKey,
    estimateSize: useCallback((index) => _estimateSize?.(index) ?? 50, [_estimateSize]),
    overscan
  })

  useImperativeHandle(
    ref,
    () => ({
      measure: () => virtualizer.measure(),
      scrollElement: () => virtualizer.scrollElement,
      scrollToOffset: (offset, options) => virtualizer.scrollToOffset(offset, options),
      scrollToIndex: (index, options) => virtualizer.scrollToIndex(index, options),
      resizeItem: (index, size) => virtualizer.resizeItem(index, size),
      getTotalSize: () => virtualizer.getTotalSize(),
      getVirtualItems: () => virtualizer.getVirtualItems(),
      getVirtualIndexes: () => virtualizer.getVirtualItems().map((item) => item.index)
    }),
    [virtualizer]
  )

  useEffect(() => {
    droppableInnerRef.current?.(scrollContainerRef.current)
    parentRef.current = scrollContainerRef.current
  })

  return (
    <div
      className={`${className} draggable-virtual-list`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', ...style }}>
      <DragDropContext onDragStart={onDragStart} onDragEnd={_onDragEnd}>
        {header}
        <Droppable
          droppableId="droppable"
          mode="virtual"
          renderClone={(provided, _snapshot, rubric) => {
            const item = list[rubric.source.index]
            return (
              <div
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                ref={provided.innerRef}
                style={{
                  ...itemStyle,
                  ...provided.draggableProps.style
                }}>
                {item && children(item, rubric.source.index)}
              </div>
            )
          }}
          {...droppableProps}>
          {(provided) => {
            droppableInnerRef.current = provided.innerRef

            return (
              <Scrollbar
                ref={scrollContainerRef}
                {...provided.droppableProps}
                className="virtual-scroller"
                style={{
                  ...scrollerStyle,
                  height: '100%',
                  width: '100%',
                  overflowY: 'auto',
                  position: 'relative'
                }}>
                <div
                  className="virtual-list"
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative'
                  }}>
                  {virtualizer.getVirtualItems().map((virtualItem) => (
                    <VirtualRow
                      key={virtualItem.key}
                      virtualItem={virtualItem}
                      list={list}
                      itemStyle={itemStyle}
                      itemContainerStyle={itemContainerStyle}
                      virtualizer={virtualizer}
                      children={children}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </Scrollbar>
            )
          }}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

/**
 * 
 */
const VirtualRow = memo(
  ({ virtualItem, list, children, itemStyle, itemContainerStyle, virtualizer, disabled }: any) => {
    const item = list[virtualItem.index]
    const draggableId = String(virtualItem.key)
    return (
      <Draggable
        key={`draggable_${draggableId}`}
        draggableId={draggableId}
        isDragDisabled={disabled}
        index={virtualItem.index}>
        {(provided) => {
          const setDragRefs = (el: HTMLElement | null) => {
            provided.innerRef(el)
            virtualizer.measureElement(el)
          }

          const dndStyle = provided.draggableProps.style
          const virtualizerTransform = `translateY(${virtualItem.start}px)`

          // dnd  transform 
          // virtualizer  translateY 
          // 
          const combinedTransform = dndStyle?.transform
            ? `${dndStyle.transform} ${virtualizerTransform}`
            : virtualizerTransform

          return (
            <div
              {...provided.draggableProps}
              ref={setDragRefs}
              className="draggable-item"
              data-index={virtualItem.index}
              style={{
                ...itemContainerStyle,
                ...dndStyle,
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: combinedTransform
              }}>
              <div {...provided.dragHandleProps} className="draggable-content" style={itemStyle}>
                {item && children(item, virtualItem.index)}
              </div>
            </div>
          )
        }}
      </Draggable>
    )
  }
)

export default DraggableVirtualList
