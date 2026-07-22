import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.hoisted(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null),
  })
})

const portalMocks = vi.hoisted(() => ({
  register: vi.fn(),
  unregister: vi.fn(),
  registerNavigator: vi.fn(),
  unregisterNavigator: vi.fn(),
}))

vi.mock('../lib/portalRegistry', () => ({ portalRegistry: portalMocks }))
vi.mock('../ui/Tooltip', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('./UrlSuggestions', () => ({ UrlSuggestions: () => null }))
vi.mock('./StartPage', () => ({ StartPage: () => <div>Start page</div> }))
vi.mock('./BrowserMenu', () => ({ BrowserMenu: () => null }))
vi.mock('./BrowserSettingsPopover', () => ({ BrowserSettingsPopover: () => null }))
vi.mock('./BrowserTabStrip', () => ({ BrowserTabStrip: () => null }))
vi.mock('./BrowserBookmarksSidebar', () => ({ BrowserBookmarksSidebar: () => null }))

import BrowserPanel from './BrowserPanel'
import { useAppStore } from '../stores/appStore'
import { useBrowserStore } from '../stores/browserStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { BrowserTab } from '../../shared/types'

const initialAppState = useAppStore.getState()
const initialBrowserState = useBrowserStore.getState()
const initialSettingsState = useSettingsStore.getState()

const updatePanelTitle = vi.fn()
const updateBrowserActiveTabUrl = vi.fn()
const updatePanelTabs = vi.fn()
const updatePanelProxy = vi.fn()
const recordVisit = vi.fn()
const unsubscribeShortcut = vi.fn()
const onBrowserShortcut = vi.fn(() => unsubscribeShortcut)
const browserSetProxy = vi.fn<(partition: string, proxyUrl: string) => Promise<void>>(async () => undefined)

let host: HTMLDivElement
let root: Root

function mount(options?: { proxyUrl?: string; tabs?: BrowserTab[]; activeTabId?: string }): void {
  const tabs = options?.tabs ?? [{ id: 'tab-1', url: 'https://initial.example', title: 'Initial' }]
  act(() => {
    root.render(
      <BrowserPanel
        panelId="browser-1"
        workspaceId="ws-1"
        nodeId="node-1"
        proxyUrl={options?.proxyUrl}
        tabs={tabs}
        activeTabId={options?.activeTabId ?? tabs[0].id}
      />,
    )
  })
}

function event(type: string, fields: Record<string, unknown> = {}): Event {
  return Object.assign(new Event(type), fields)
}

function installWebviewMethods(webview: HTMLElement) {
  const methods = {
    loadURL: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    canGoBack: vi.fn(() => true),
    canGoForward: vi.fn(() => false),
    isLoading: vi.fn(() => false),
    getURL: vi.fn(() => 'https://navigated.example/page'),
    getTitle: vi.fn(() => 'Navigated title'),
    getWebContentsId: vi.fn(() => 42),
    executeJavaScript: vi.fn(async () => undefined),
  }
  Object.assign(webview, methods)
  return methods
}

async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  vi.clearAllMocks()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  useAppStore.setState({
    updatePanelTitle,
    updateBrowserActiveTabUrl,
    updatePanelTabs,
    updatePanelProxy,
  })
  useBrowserStore.setState({
    bookmarks: [],
    recordVisit,
    toggleBookmark: vi.fn(),
    querySuggestions: vi.fn(() => []),
  })
  useSettingsStore.setState({
    browserHomepage: 'https://home.example',
    browserSearchEngine: 'google',
    browserNewTabBehavior: 'startPage',
    browserShowTabSidebar: false,
    setSetting: vi.fn(),
  })
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    onBrowserShortcut,
    browserSetProxy,
    webviewScreenshot: vi.fn(async () => null),
    browserClearData: vi.fn(async () => undefined),
    showContextMenu: vi.fn(async () => null),
  }
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useAppStore.setState(initialAppState, true)
  useBrowserStore.setState(initialBrowserState, true)
  useSettingsStore.setState(initialSettingsState, true)
})

describe('BrowserPanel component', () => {
  it('persists a completed navigation, records history, and updates navigation controls', () => {
    mount()
    const webview = host.querySelector('webview') as HTMLElement
    const methods = installWebviewMethods(webview)

    act(() => {
      webview.dispatchEvent(event('did-navigate', { url: 'https://navigated.example/page' }))
    })

    expect(updateBrowserActiveTabUrl).toHaveBeenCalledWith(
      'ws-1',
      'browser-1',
      'https://navigated.example/page',
    )
    expect(recordVisit).toHaveBeenCalledWith('https://navigated.example/page', 'Navigated title')
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('https://navigated.example/page')
    expect((host.querySelector('button[aria-label="Back"]') as HTMLButtonElement).disabled).toBe(false)
    expect((host.querySelector('button[aria-label="Forward"]') as HTMLButtonElement).disabled).toBe(true)
    expect(updatePanelTabs).toHaveBeenLastCalledWith(
      'ws-1',
      'browser-1',
      [{ id: 'tab-1', url: 'https://navigated.example/page', title: 'Navigated title' }],
      'tab-1',
    )
    expect(methods.canGoBack).toHaveBeenCalled()
  })

  it('ignores subframe failures but surfaces a main-frame failure with a working retry', () => {
    mount()
    const webview = host.querySelector('webview') as HTMLElement
    const methods = installWebviewMethods(webview)

    act(() => {
      webview.dispatchEvent(event('did-fail-load', {
        errorCode: -105,
        errorDescription: 'Tracker failed',
        isMainFrame: false,
      }))
    })
    expect(host.textContent).not.toContain('Tracker failed')

    act(() => {
      webview.dispatchEvent(event('did-fail-load', {
        errorCode: -105,
        errorDescription: 'DNS lookup failed',
        isMainFrame: true,
      }))
    })
    expect(host.textContent).toContain('DNS lookup failed')

    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Try Again')
    expect(retry).toBeTruthy()
    act(() => retry!.click())
    expect(methods.reload).toHaveBeenCalledTimes(1)
  })

  it('waits for proxy configuration before attaching the webview', async () => {
    let releaseProxy!: () => void
    browserSetProxy.mockReturnValueOnce(new Promise<void>((resolve) => { releaseProxy = resolve }))

    mount({ proxyUrl: ' http://proxy.example:8080 ' })

    expect(host.querySelector('webview')).toBeNull()
    expect(browserSetProxy).toHaveBeenCalledTimes(1)
    expect(browserSetProxy.mock.calls[0][0]).toMatch(/^persist:browser-proxy-/)
    expect(browserSetProxy.mock.calls[0][1]).toBe(' http://proxy.example:8080 ')

    await act(async () => {
      releaseProxy()
      await Promise.resolve()
    })
    const webview = host.querySelector('webview')
    expect(webview).toBeTruthy()
    expect(webview?.getAttribute('partition')).toMatch(/^persist:browser-proxy-/)
  })

  it('unregisters the guest and subscriptions, and removes webview listeners on unmount', async () => {
    mount()
    const webview = host.querySelector('webview') as HTMLElement
    installWebviewMethods(webview)
    act(() => webview.dispatchEvent(event('dom-ready')))
    expect(portalMocks.register).toHaveBeenCalledWith('browser-1', webview)
    // The navigator registers at mount (not dom-ready): it is how the reverse
    // API reaches a panel sitting on its start page, which has no webview.
    expect(portalMocks.registerNavigator).toHaveBeenCalledWith('browser-1', expect.any(Function))

    act(() => root.unmount())
    expect(portalMocks.unregister).toHaveBeenCalledWith('browser-1')
    expect(portalMocks.unregisterNavigator).toHaveBeenCalledWith('browser-1')
    expect(unsubscribeShortcut).toHaveBeenCalledTimes(1)

    const persistedCalls = updateBrowserActiveTabUrl.mock.calls.length
    act(() => webview.dispatchEvent(event('did-navigate', { url: 'https://late.example' })))
    expect(updateBrowserActiveTabUrl).toHaveBeenCalledTimes(persistedCalls)

    root = createRoot(host)
    await flush()
  })
})
