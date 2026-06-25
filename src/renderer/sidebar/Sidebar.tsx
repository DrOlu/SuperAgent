import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ProjectList } from './ProjectList'
import { FileExplorer } from './FileExplorer'
import { SearchView } from './SearchView'
import { SourceControlView } from './SourceControlView'
import { useAppStore } from '../stores/appStore'
import { useUIStore, useSidebarLayout } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { SidebarView, SidebarSide } from '../stores/uiStore'
import {
  FolderOpen,
  GitBranch,
  Stack,
  Gear,
  MagnifyingGlass,
  FloppyDisk,
  PuzzlePiece,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import pkg from '../../../package.json'
import { Tooltip } from '../ui/Tooltip'

// ---------------------------------------------------------------------------
// View metadata — icon + title for each possible sidebar view
// ---------------------------------------------------------------------------

const VIEW_META: Record<SidebarView, { icon: PhosphorIcon; title: string }> = {
  workspaces: { icon: Stack, title: 'Workspaces' },
  explorer: { icon: FolderOpen, title: 'Explorer' },
  search: { icon: MagnifyingGlass, title: 'Search' },
  git: { icon: GitBranch, title: 'Source Control' },
}

// ---------------------------------------------------------------------------
// Content renderer — renders whichever view is active, regardless of side
// ---------------------------------------------------------------------------

const SidebarViewContent: React.FC<{ view: SidebarView; rootPath: string }> = ({
  view,
  rootPath,
}) => {
  const selectedWorkspaceId = useAppStore((s) => s.selectedWorkspaceId)
  const setWorkspaceRootPath = useAppStore((s) => s.setWorkspaceRootPath)

  switch (view) {
    case 'workspaces':
      return <ProjectList />
    case 'explorer':
      return rootPath ? (
        <FileExplorer rootPath={rootPath} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted text-xs gap-3 p-4">
          <span>No folder open</span>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-secondary hover:text-primary bg-surface-5 hover:bg-hover transition-colors"
            onClick={async () => {
              const path = await window.electronAPI.openFolderDialog()
              if (path && selectedWorkspaceId) {
                setWorkspaceRootPath(selectedWorkspaceId, path)
              }
            }}
          >
            <FolderOpen size={13} />
            Open Folder
          </button>
        </div>
      )
    case 'search':
      return <SearchView rootPath={rootPath} workspaceId={selectedWorkspaceId} />
    case 'git':
      return <SourceControlView rootPath={rootPath} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Shared activity bar sidebar — parameterized by side
// ---------------------------------------------------------------------------

const DRAG_MIME = 'application/x-cate-view'
const BAR_WIDTH = 40

interface ActivityBarSidebarProps {
  side: SidebarSide
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

const ActivityBarSidebar: React.FC<ActivityBarSidebarProps> = ({ side, defaultWidth, minWidth, maxWidth }) => {
  const layout = useSidebarLayout()
  const views = layout[side]
  const tintOpacity = useSettingsStore((s) => s.sidebarTintOpacity)
  const activeView = useUIStore((s) => (side === 'left' ? s.activeLeftSidebarView : s.activeRightSidebarView))
  const setActiveView = useUIStore((s) =>
    side === 'left' ? s.setActiveLeftSidebarView : s.setActiveRightSidebarView,
  )
  const moveSidebarView = useUIStore((s) => s.moveSidebarView)
  const draggingView = useUIStore((s) => s.draggingView)
  const setDraggingView = useUIStore((s) => s.setDraggingView)
  const isDragActive = draggingView !== null

  // Guard: if activeView is not present on this side (e.g. just moved away), clear it
  useEffect(() => {
    if (activeView !== null && !views.includes(activeView)) {
      setActiveView(null)
    }
  }, [activeView, views, setActiveView])

  const isExpanded = activeView !== null
  const isEmpty = views.length === 0

  // When empty, the sidebar is hidden. During a drag, if the cursor enters
  // this side's half of the window, we reveal it so the user can drop here.
  const [dragRevealed, setDragRevealed] = useState(false)
  useEffect(() => {
    if (!isDragActive || !isEmpty) {
      setDragRevealed(false)
      return
    }
    const onDragOver = (e: DragEvent) => {
      const half = window.innerWidth / 2
      const inside = side === 'left' ? e.clientX < half : e.clientX >= half
      setDragRevealed(inside)
    }
    window.addEventListener('dragover', onDragOver)
    return () => window.removeEventListener('dragover', onDragOver)
  }, [isDragActive, isEmpty, side])

  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Drop indicator: index where the drop would land. Mirrored in a ref so the
  // drop handler reads the latest value (state updates from dragOver may not
  // have flushed by the time drop fires).
  const [dropIndicator, setDropIndicatorState] = useState<number | null>(null)
  const dropIndicatorRef = useRef<number | null>(null)
  const setDropIndicator = useCallback((value: number | null | ((prev: number | null) => number | null)) => {
    const next = typeof value === 'function' ? value(dropIndicatorRef.current) : value
    dropIndicatorRef.current = next
    setDropIndicatorState(next)
  }, [])

  const selectedWorkspace = useAppStore((s) => {
    const id = s.selectedWorkspaceId
    return s.workspaces.find((w) => w.id === id)
  })
  const rootPath = selectedWorkspace?.rootPath ?? ''

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
  }, [width])

  useEffect(() => {
    if (!isResizing) return
    let pendingX = startXRef.current
    let rafId = 0
    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          // Left: dragging right grows width; Right: dragging left grows width.
          const delta = side === 'left' ? pendingX - startXRef.current : startXRef.current - pendingX
          setWidth(Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta)))
        })
      }
    }
    const onUp = () => setIsResizing(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isResizing, side, minWidth, maxWidth])

  const handleIconClick = useCallback((view: SidebarView) => {
    if (activeView === view) setActiveView(null)
    else setActiveView(view)
  }, [activeView, setActiveView])

  // --- Drag handlers ---

  const handleIconDragStart = (e: React.DragEvent, view: SidebarView) => {
    e.dataTransfer.setData(DRAG_MIME, view)
    e.dataTransfer.setData('text/plain', view)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingView(view)
  }

  const handleIconDragEnd = () => {
    setDraggingView(null)
    setDropIndicator(null)
  }

  const iconsContainerRef = useRef<HTMLDivElement | null>(null)

  const computeDropIndex = (clientY: number): number => {
    const container = iconsContainerRef.current
    if (!container) return views.length
    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-sidebar-icon]'))
    if (buttons.length === 0) return 0
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return buttons.length
  }

  const handleBarDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleBarDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropIndicator(computeDropIndex(e.clientY))
  }

  const handleBarDragLeave = (e: React.DragEvent) => {
    // Only clear when leaving the bar entirely
    const related = e.relatedTarget as Node | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setDropIndicator(null)
    }
  }

  const handleBarDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const view = ((e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain')) as SidebarView) || draggingView
    // Compute index fresh from cursor position — relying on the indicator
    // ref is unsafe because dragleave with null relatedTarget can clear it
    // immediately before drop fires.
    const targetIndex = computeDropIndex(e.clientY)
    setDropIndicator(null)
    setDraggingView(null)
    if (!view) return
    moveSidebarView(view, side, targetIndex)
  }

  // --- Render ---

  const bar = (
    <div
      className="flex-shrink-0 flex flex-col items-center h-full relative"
      style={{
        width: BAR_WIDTH,
        backgroundColor: isExpanded
          ? 'color-mix(in srgb, var(--surface-0) 60%, transparent)'
          : undefined,
      }}
      onDragEnter={handleBarDragEnter}
      onDragOver={handleBarDragOver}
      onDragLeave={handleBarDragLeave}
      onDrop={handleBarDrop}
    >
      <div ref={iconsContainerRef} className="flex flex-col items-center pt-0.5 w-full relative">
        {views.map((view, index) => {
          const meta = VIEW_META[view]
          const Icon = meta.icon
          const isActive = activeView === view
          const showIndicatorBefore = isDragActive && dropIndicator === index
          const showIndicatorAfter = isDragActive && index === views.length - 1 && dropIndicator === views.length
          return (
            <React.Fragment key={view}>
              {showIndicatorBefore && (
                <div className="w-7 h-[2px] my-0.5 bg-blue-400 rounded-full pointer-events-none" />
              )}
              <div className="relative w-full flex items-center justify-center">
              <div
                role="button"
                tabIndex={0}
                data-sidebar-icon=""
                draggable
                onDragStart={(e) => handleIconDragStart(e, view)}
                onDragEnd={handleIconDragEnd}
                className={`relative flex items-center justify-center w-8 h-8 my-1 rounded transition-colors cursor-pointer ${
                  isActive ? 'text-primary' : 'text-muted hover:text-secondary'
                }`}
                onClick={() => handleIconClick(view)}
                title={isActive ? `${meta.title}. Click to collapse.` : meta.title}
              >
                <Icon size={16} className="pointer-events-none" />
              </div>
            </div>
              {showIndicatorAfter && (
                <div className="w-7 h-[2px] my-0.5 bg-blue-400 rounded-full pointer-events-none" />
              )}
            </React.Fragment>
          )
        })}
        {isDragActive && views.length === 0 && dropIndicator !== null && (
          <div className="w-7 h-[2px] my-0.5 bg-blue-400 rounded-full pointer-events-none" />
        )}
      </div>
      {side === 'left' && (
        <div className="mt-auto flex flex-col items-center pb-1 w-full">
          {/* The standalone ⌘K search icon was removed now that the dedicated
              Search view exists; ⌘K still opens the command palette via keyboard. */}
          <Tooltip label="Skills" placement="right">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 my-1 rounded text-muted hover:text-secondary transition-colors"
              onClick={() => useUIStore.getState().setShowSkillsDialog(true)}
              aria-label="Skills"
            >
              <PuzzlePiece size={16} className="pointer-events-none" />
            </button>
          </Tooltip>
          <Tooltip label="Saved Layouts" placement="right">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 my-1 rounded text-muted hover:text-secondary transition-colors"
              onClick={() => useUIStore.getState().setShowLayoutsDialog(true)}
              aria-label="Saved Layouts"
            >
              <FloppyDisk size={16} className="pointer-events-none" />
            </button>
          </Tooltip>
          <Tooltip label="Settings" placement="right">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 my-1 rounded text-muted hover:text-secondary transition-colors"
              onClick={() => useUIStore.getState().openSettings()}
              aria-label="Settings"
            >
              <Gear size={16} className="pointer-events-none" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  )

  const content = (
    <div
      className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-opacity duration-200 relative ${
        isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${
        // Left sidebar's vertical scrollbar is on its right edge — exactly where
        // the 6px resize handle sits. Inset the content by the handle width so
        // the scrollbar clears it and stays draggable. (The right sidebar's
        // scrollbar is next to its activity bar, away from its handle.)
        side === 'left' ? 'pr-1' : ''
      }`}
    >
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeView && (
          <div key={activeView} className="absolute inset-0 animate-sidebar-view-in">
            <SidebarViewContent view={activeView} rootPath={rootPath} />
          </div>
        )}
      </div>
      {/* Version marker — shown on whichever side hosts the workspaces view */}
      {isExpanded && activeView === 'workspaces' && (
        <div className="flex-shrink-0 px-2 pt-1.5 pb-4 flex items-center justify-center gap-1.5 select-none">
          <svg viewBox="0 0 512 512" className="h-3 w-auto text-secondary" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="SuperAgent">
            <path d="M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z" fill="currentColor"/>
            <path d="M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z" fill="#FFFFFF"/>
          </svg>
          <span className="text-[10px] text-muted">v{pkg.version}</span>
        </div>
      )}
    </div>
  )

  return (
    <div
      data-sidebar-scrollarea
      className={`flex-shrink-0 relative flex flex-row h-full select-none overflow-hidden ${
        isResizing ? '' : 'transition-[width] duration-200 ease-in-out'
      }`}
      style={{
        width:
          isEmpty && !dragRevealed
            ? 0
            : isExpanded
              ? BAR_WIDTH + width
              : BAR_WIDTH,
        // Static translucent fill — no backdrop-filter. A live blur forces the
        // compositor to re-sample everything behind the sidebar on every frame
        // that anything underneath changes (a major sustained WindowServer cost
        // given the canvas/terminals behind it). A near-opaque tint reads as the
        // same frosted surface without the per-frame compositing. The fill
        // percentage is the user's "Background opacity" sidebar setting.
        backgroundColor: `color-mix(in srgb, var(--surface-1) ${Math.round(tintOpacity * 100)}%, transparent)`,
      }}
    >
      {/* Opaque top strip — matches the dock tab bar height (36px) so the
          sidebar chrome lines up with the canvas tab bar. */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-9"
        style={{ backgroundColor: 'var(--surface-1)' }}
      />
      {side === 'left' ? (
        <>
          {bar}
          {content}
        </>
      ) : (
        <>
          {content}
          {bar}
        </>
      )}

      {/* Resize handle on the inner edge, only when expanded */}
      {isExpanded && (
        <div
          className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} w-[4px] h-full cursor-col-resize z-10 ${
            isResizing ? 'bg-blue-500/30' : ''
          }`}
          onMouseDown={handleResizeDown}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public wrappers
// ---------------------------------------------------------------------------

export const Sidebar: React.FC = () => (
  <ActivityBarSidebar side="left" defaultWidth={220} minWidth={140} maxWidth={400} />
)

export const RightSidebar: React.FC = () => (
  <ActivityBarSidebar side="right" defaultWidth={340} minWidth={240} maxWidth={600} />
)
