import { useState, useEffect, useCallback } from 'react'
import log from '../lib/logger'
import { useAppStore } from '../stores/appStore'
import { ensureWorkspaceFolder } from '../hooks/useShortcuts'
import {
  Terminal,
  Globe,
  FileCode,
  FolderOpen,
  Keyboard,
  Folder,
  CloudArrowUp,
} from '@phosphor-icons/react'
import { abbreviateLocalPath, workspaceDisplayName } from '../lib/fs/displayPath'
import { parseLocator, LOCAL_COMPANION_ID } from '../../main/companion/locator'
import { RemoteConnectDialog } from '../dialogs/RemoteConnectDialog'
import { workspaceRuntime } from '../lib/workspace/workspaceRuntime'
import type { RemoteConnectSpec } from '../../shared/types'

// Abbreviate home directory in paths
export default function WelcomePage({ workspaceId }: { workspaceId: string }) {
  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [showRemote, setShowRemote] = useState(false)
  const [remotePending, setRemotePending] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  const connectRemote = useCallback(
    async (spec: RemoteConnectSpec) => {
      setRemotePending(true)
      setRemoteError(null)
      const app = useAppStore.getState()
      const ok = await app.connectRemoteWorkspace(workspaceId, spec)
      setRemotePending(false)
      if (ok) {
        setShowRemote(false)
        // The workspace is registered; the probe drives its phase. Only spawn a
        // terminal if it actually connected — otherwise the canvas lock shows
        // the probed state (missing → Install, unreachable → Retry/Edit).
        const ws = useAppStore.getState().workspaces.find((w) => w.id === workspaceId)
        if (workspaceRuntime(ws).editable) app.createTerminal(workspaceId)
      } else {
        const ws = useAppStore.getState().workspaces.find((w) => w.id === workspaceId)
        setRemoteError(ws?.companion?.error ?? 'Failed to connect')
      }
    },
    [workspaceId],
  )

  useEffect(() => {
    window.electronAPI.recentProjectsGet().then(setRecentProjects).catch((err) => log.warn('[welcome] Failed to load recent projects:', err))
  }, [])

  const openFolder = useCallback(async () => {
    const path = await window.electronAPI.openFolderDialog()
    if (!path) return
    const app = useAppStore.getState()
    const ok = await app.setWorkspaceRootPath(workspaceId, path)
    if (ok) app.createTerminal(workspaceId)
  }, [workspaceId])

  const openRecentProject = useCallback(
    async (path: string) => {
      const app = useAppStore.getState()
      const ok = await app.setWorkspaceRootPath(workspaceId, path)
      if (ok) app.createTerminal(workspaceId)
    },
    [workspaceId],
  )

  const newTerminal = useCallback(async () => {
    const wsId = await ensureWorkspaceFolder(workspaceId)
    if (wsId) useAppStore.getState().createTerminal(wsId)
  }, [workspaceId])

  const newEditor = useCallback(async () => {
    const wsId = await ensureWorkspaceFolder(workspaceId)
    if (wsId) useAppStore.getState().createEditor(wsId)
  }, [workspaceId])

  const newBrowser = useCallback(async () => {
    const wsId = await ensureWorkspaceFolder(workspaceId)
    if (wsId) useAppStore.getState().createBrowser(wsId)
  }, [workspaceId])

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="pointer-events-auto max-w-2xl w-full px-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 text-primary mb-2">
            <path d="M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z" fill="currentColor"/>
            <path d="M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z" fill="#FFFFFF"/>
          </svg>
          <p className="text-sm text-muted mt-1">
            Infinite canvas for coding
          </p>
        </div>

        {/* Two-column layout: Start + Recent */}
        <div className="flex gap-12">
          {/* Start actions */}
          <div data-onboarding="welcome-actions" className="flex-1">
            <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
              Start
            </h2>
            <div className="flex flex-col gap-1">
              <ActionItem
                icon={<FolderOpen size={16} />}
                label="Open Folder..."
                onClick={openFolder}
              />
              <ActionItem
                icon={<CloudArrowUp size={16} />}
                label="Connect to Remote..."
                onClick={() => { setRemoteError(null); setShowRemote(true) }}
              />
              <ActionItem
                icon={<Terminal size={16} />}
                label="New Terminal"
                shortcut="⌘T"
                onClick={newTerminal}
              />
              <ActionItem
                icon={<FileCode size={16} />}
                label="New Editor"
                shortcut="⌘⇧E"
                onClick={newEditor}
              />
              <ActionItem
                icon={<Globe size={16} />}
                label="New Browser"
                shortcut="⌘⇧B"
                onClick={newBrowser}
              />
            </div>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div className="flex-1">
              <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
                Recent
              </h2>
              <div className="flex flex-col gap-0.5">
                {recentProjects.map((projectPath) => {
                  const { companionId, path: decodedPath } = parseLocator(projectPath)
                  // Local paths are OS-native — split on `\` too so Windows paths
                  // ("C:\Users\foo\proj") don't render as one long segment.
                  const sep = companionId === LOCAL_COMPANION_ID ? /[\\/]/ : /\//
                  const name = workspaceDisplayName(projectPath) || projectPath
                  const parentPath = decodedPath.split(sep).slice(0, -1).join('/')
                  const parent = companionId === LOCAL_COMPANION_ID
                    ? abbreviateLocalPath(parentPath)
                    : `${companionId}:${parentPath}`
                  return (
                    <button
                      key={projectPath}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-hover transition-colors group"
                      onClick={() => openRecentProject(projectPath)}
                    >
                      <Folder
                        size={14}
                        className="text-muted group-hover:text-secondary flex-shrink-0"
                      />
                      <span className="text-sm text-focus-blue group-hover:text-focus-blue truncate">
                        {name}
                      </span>
                      <span className="text-xs text-muted truncate">
                        {parent}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-10 pt-6">
          <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <ShortcutRow keys="⌘T" label="New Terminal" />
            <ShortcutRow keys="⌘⇧B" label="New Browser" />
            <ShortcutRow keys="⌘⇧E" label="New Editor" />
            <ShortcutRow keys="⌘K" label="Command Palette" />
            <ShortcutRow keys="⌘\" label="Toggle Sidebar" />
            <ShortcutRow keys="⌘0" label="Reset Zoom" />
          </div>
        </div>
      </div>

      {showRemote && (
        <RemoteConnectDialog
          onSubmit={connectRemote}
          onClose={() => setShowRemote(false)}
          pending={remotePending}
          error={remoteError}
        />
      )}
    </div>
  )
}

function ActionItem({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
}) {
  return (
    <button
      className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-hover transition-colors group"
      onClick={onClick}
    >
      <span className="text-muted group-hover:text-secondary">{icon}</span>
      <span className="text-sm text-focus-blue group-hover:text-focus-blue">
        {label}
      </span>
      {shortcut && (
        <span className="ml-auto text-xs text-muted">{shortcut}</span>
      )}
    </button>
  )
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-secondary font-mono w-10 text-right">
        {keys}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}
