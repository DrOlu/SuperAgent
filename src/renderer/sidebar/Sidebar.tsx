import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ProjectList } from './ProjectList'
import { FileExplorer } from './FileExplorer'
import { SearchView } from './SearchView'
import { SourceControlView } from './SourceControlView'
import { CateAgentSidebarView } from '../cateAgent/CateAgentSidebarView'
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
  SidebarSimple,
} from '@phosphor-icons/react'
import pkg from '../../../package.json'
import { Tooltip } from '../ui/Tooltip'
import { CateLogo } from '../ui/CateLogo'
import { IS_MAC } from '../lib/platform'
import { useWindowFullscreen } from '../lib/useWindowFullscreen'
import { MAC_CHROME_HEIGHT } from '../shells/MacWindowChrome'

// ---------------------------------------------------------------------------
// View metadata — icon + title for each possible sidebar view
// ---------------------------------------------------------------------------

// Icons are called as `<Icon size={n} className=… />`; Phosphor icons and the
// Cate wordmark both satisfy this call signature. A plain function type (rather
// than ComponentType) sidesteps the static propTypes clash between Phosphor's
// forward-ref icons and a custom SVG component.
type SidebarViewIcon = (props: { size?: number; className?: string }) => React.ReactNode

const VIEW_META: Record<SidebarView, { icon: SidebarViewIcon; title: string }> = {
  workspaces: { icon: Stack, title: 'Workspaces' },
  explorer: { icon: FolderOpen, title: 'Explorer' },
  search: { icon: MagnifyingGlass, title: 'Search' },
  git: { icon: GitBranch, title: 'Source Control' },
  cateAgent: { icon: CateLogo, title: 'Cate Agent' },
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
    case 'cateAgent':
      return <CateAgentSidebarView wsId={selectedWorkspaceId ?? ''} rootPath={rootPath} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Shared activity bar sidebar — parameterized by side
// ---------------------------------------------------------------------------

/** Width of an activity-bar rail (icon strip). Shared with MainWindowShell so
 *  it can reserve the right amount of top-left space past the macOS lights. */
export const BAR_WIDTH = 40

// dataTransfer MIME for rail-to-rail view drags. Native HTML5 DnD is used here
// (same-window, lightweight) — deliberately separate from the panel useDragStore
// system, which handles cross-window panel drags.
const DRAG_MIME = 'application/x-cate-sidebar-view'

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
  // Either sidebar can be fully hidden (rail + content, width 0) via its top
  // toggle; reopened from the floating edge toggle in MainWindowShell. Selected
  // by side so the shared rail's toggle drives the correct one.
  const leftSidebarHidden = useUIStore((s) => s.leftSidebarHidden)
  const rightSidebarHidden = useUIStore((s) => s.rightSidebarHidden)
  const setLeftSidebarHidden = useUIStore((s) => s.setLeftSidebarHidden)
  const setRightSidebarHidden = useUIStore((s) => s.setRightSidebarHidden)
  const sidebarHidden = side === 'left' ? leftSidebarHidden : rightSidebarHidden
  const setSidebarHidden = side === 'left' ? setLeftSidebarHidden : setRightSidebarHidden

  // Rail-to-rail view drag (native HTML5 DnD). draggingView is shared across
  // both rails so each can act as a drop target for the other.
  const moveSidebarView = useUIStore((s) => s.moveSidebarView)
  const draggingView = useUIStore((s) => s.draggingView)
  const setDraggingView = useUIStore((s) => s.setDraggingView)
  const isDragActive = draggingView !== null

  // Guard: if activeView is not present on this side (e.g. layout changed), clear it
  useEffect(() => {
    if (activeView !== null && !views.includes(activeView)) {
      setActiveView(null)
    }
  }, [activeView, views, setActiveView])

  const isExpanded = activeView !== null
  const isEmpty = views.length === 0

  // macOS: the traffic-light island (MacWindowChrome) floats over the top-left,
  // so the left sidebar insets its content below it while its surface fills to
  // y=0 (seamless behind the lights). Only the left side sits under it. Nothing
  // of ours lives in that strip any more (the rail carries its own toggle in its
  // own 36px header), so it exists purely to clear the lights — in native
  // fullscreen the OS hides them and the inset must collapse, or the rail and
  // content stay pushed down by an empty band.
  const isFullscreen = useWindowFullscreen()
  const macChromeInset = side === 'left' && IS_MAC && !isFullscreen ? MAC_CHROME_HEIGHT : 0

  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // When a rail is empty it collapses to 0. During a view drag, reveal it as a
  // drop target when the cursor enters this side's half of the window, so a user
  // can move every view off a rail and still drop back onto it.
  const [dragRevealed, setDragRevealed] = useState(false)
  useEffect(() => {
    if (!isDragActive || !isEmpty) {
      setDragRevealed(false)
      return
    }
    const onDragOver = (e: DragEvent) => {
      const half = window.innerWidth / 2
      setDragRevealed(side === 'left' ? e.clientX < half : e.clientX >= half)
    }
    window.addEventListener('dragover', onDragOver)
    return () => window.removeEventListener('dragover', onDragOver)
  }, [isDragActive, isEmpty, side])

  // Drop indicator: the index where a drop would land among this rail's icons.
  // Mirrored in a ref because the drop handler needs the freshest value (dragOver
  // state updates may not have flushed, and dragLeave can clear it just before
  // drop fires).
  const [dropIndicator, setDropIndicatorState] = useState<number | null>(null)
  const dropIndicatorRef = useRef<number | null>(null)
  const setDropIndicator = useCallback((value: number | null) => {
    dropIndicatorRef.current = value
    setDropIndicatorState(value)
  }, [])
  const iconsContainerRef = useRef<HTMLDivElement | null>(null)

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

  // --- Drag handlers (rail-to-rail view DnD) ---

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

  // Index (0..views.length) where a drop at clientY would insert, from each
  // icon's mid-height.
  const computeDropIndex = (clientY: number): number => {
    const container = iconsContainerRef.current
    if (!container) return views.length
    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-sidebar-icon]'))
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return buttons.length
  }

  const handleBarDragOver = (e: React.DragEvent) => {
    if (!isDragActive) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropIndicator(computeDropIndex(e.clientY))
  }

  const handleBarDragLeave = (e: React.DragEvent) => {
    // Only clear when the cursor leaves the bar entirely (not on inner moves).
    const related = e.relatedTarget as Node | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setDropIndicator(null)
    }
  }

  const handleBarDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const view = ((e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain')) as SidebarView) || draggingView
    // Recompute from the cursor — the indicator ref can be cleared by a stray
    // dragLeave immediately before drop fires.
    const targetIndex = computeDropIndex(e.clientY)
    setDropIndicator(null)
    setDraggingView(null)
    if (view) moveSidebarView(view, side, targetIndex)
  }

  // --- Render ---

  // Drop-indicator line shown between icons during a view drag.
  const dropLine = (
    <div className="w-6 h-[2px] my-0.5 bg-blue-400 rounded-full pointer-events-none" />
  )

  const bar = (
    <div
      className="flex-shrink-0 flex flex-col items-center h-full relative"
      style={{
        width: BAR_WIDTH,
        backgroundColor: isExpanded
          ? 'color-mix(in srgb, var(--surface-0) 60%, transparent)'
          : undefined,
      }}
      onDragOver={handleBarDragOver}
      onDragLeave={handleBarDragLeave}
      onDrop={handleBarDrop}
    >
      {/* Collapse toggle — its own 36px header so it centers on the same line
          as the canvas tab bar's +/split buttons, then fully hides this
          sidebar. Reopened from the floating edge toggle in MainWindowShell.
          The icon points toward the window edge it collapses to. */}
      <div className="flex items-center justify-center w-full flex-shrink-0" style={{ height: 36 }}>
        <Tooltip label="Hide sidebar" placement={side === 'left' ? 'right' : 'left'}>
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-secondary hover:bg-hover transition-colors"
            onClick={() => setSidebarHidden(true)}
            aria-label="Hide sidebar"
          >
            <SidebarSimple
              size={16}
              className="pointer-events-none"
              style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}
            />
          </button>
        </Tooltip>
      </div>
      <div ref={iconsContainerRef} className="flex flex-col items-center w-full relative">
        {views.map((view, index) => {
          const meta = VIEW_META[view]
          const Icon = meta.icon
          const isActive = activeView === view
          const showBefore = isDragActive && dropIndicator === index
          const showAfter =
            isDragActive && index === views.length - 1 && dropIndicator === views.length
          return (
            <React.Fragment key={view}>
              {showBefore && dropLine}
              <div className="relative w-full flex items-center justify-center">
                <div
                  role="button"
                  tabIndex={0}
                  data-sidebar-icon=""
                  draggable
                  onDragStart={(e) => handleIconDragStart(e, view)}
                  onDragEnd={handleIconDragEnd}
                  className={`relative flex items-center justify-center w-8 h-8 my-1 rounded-lg transition-colors cursor-pointer ${
                    isActive ? 'text-primary' : 'text-muted hover:text-secondary'
                  }`}
                  onClick={() => handleIconClick(view)}
                  title={isActive ? `${meta.title}. Click to collapse.` : meta.title}
                >
                  <Icon size={16} className="pointer-events-none" />
                </div>
              </div>
              {showAfter && dropLine}
            </React.Fragment>
          )
        })}
        {/* Empty-rail drop target (revealed during a drag). */}
        {isDragActive && views.length === 0 && dropIndicator !== null && dropLine}
      </div>
      {side === 'right' && (
        <div className="mt-auto flex flex-col items-center pb-1 w-full">
          {/* The standalone ⌘K search icon was removed now that the dedicated
              Search view exists; ⌘K still opens the command palette via keyboard. */}
          <Tooltip label="Skills" placement="left">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 my-1 rounded-lg text-muted hover:text-secondary transition-colors"
              onClick={() => useUIStore.getState().setShowSkillsDialog(true)}
              aria-label="Skills"
            >
              <PuzzlePiece size={16} className="pointer-events-none" />
            </button>
          </Tooltip>
          <Tooltip label="Saved Layouts" placement="left">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 my-1 rounded-lg text-muted hover:text-secondary transition-colors"
              onClick={() => useUIStore.getState().setShowLayoutsDialog(true)}
              aria-label="Saved Layouts"
            >
              <FloppyDisk size={16} className="pointer-events-none" />
            </button>
          </Tooltip>
          <Tooltip label="Settings" placement="left">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 my-1 rounded-lg text-muted hover:text-secondary transition-colors"
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

  // Both rails share the three-state model: fully hidden (0), rail-only
  // (BAR_WIDTH), or opened (BAR_WIDTH + content width). An empty rail collapses
  // to 0 unless a drag revealed it as a drop target. The right rail also hosts
  // the skills/layouts/settings actions; the left does not.
  const sidebarWidth =
    sidebarHidden || (isEmpty && !dragRevealed)
      ? 0
      : isExpanded
        ? BAR_WIDTH + width
        : BAR_WIDTH

  return (
    <div
      data-sidebar-scrollarea
      className={`flex-shrink-0 relative flex flex-row h-full select-none overflow-hidden ${
        isResizing ? '' : 'transition-[width] duration-200 ease-in-out'
      } ${
        // Hairline seam on each rail's canvas-facing edge (right rail's left
        // edge, left rail's right edge). Omitted at 0 width so no stray 1px
        // line shows when collapsed.
        sidebarWidth === 0
          ? ''
          : side === 'right'
            ? 'border-l border-subtle'
            : 'border-r border-subtle'
      }`}
      style={{
        width: sidebarWidth,
        // macOS: reserve the traffic-light island's height at the top so the
        // sidebar's surface fills to y=0 (seamless behind the lights) while its
        // content starts below them. box-sizing keeps the fill under the padding.
        paddingTop: macChromeInset,
        // Static translucent fill — no backdrop-filter. A live blur forces the
        // compositor to re-sample everything behind the sidebar on every frame
        // that anything underneath changes (a major sustained WindowServer cost
        // given the canvas/terminals behind it). A near-opaque tint reads as the
        // same frosted surface without the per-frame compositing. The fill
        // percentage is the user's "Background opacity" sidebar setting.
        // Right sidebar blends into the canvas (canvas-bg); left stays brighter
        // (surface-1). Both respect the user's "Background opacity" setting.
        backgroundColor: `color-mix(in srgb, var(${side === 'right' ? '--canvas-bg' : '--surface-1'}) ${Math.round(tintOpacity * 100)}%, transparent)`,
      }}
    >
      {/* Opaque top strip — matches the dock tab bar height (36px) so the
          sidebar chrome lines up with the canvas tab bar. On the macOS left
          sidebar this band is the traffic-light inset (macChromeInset): nothing
          interactive sits under it (the rail/content start below the inset), so
          make it a window-drag region — otherwise the strip beside the traffic
          lights is a dead zone you can't drag the window by. Elsewhere it stays
          inert (pointer-events-none). */}
      <div
        className={`absolute top-0 left-0 right-0 h-9 ${macChromeInset > 0 ? '' : 'pointer-events-none'}`}
        style={{
          backgroundColor: side === 'right' ? 'var(--canvas-bg)' : 'var(--surface-1)',
          ...(macChromeInset > 0 ? { WebkitAppRegion: 'drag' } : {}),
        } as React.CSSProperties}
      />
      {/* Rail hugs the window edge (left rail on the left, right rail on the
          right); content sits on the canvas-facing side of each. */}
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
