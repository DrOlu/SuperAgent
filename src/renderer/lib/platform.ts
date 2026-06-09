// Single source of the renderer's macOS check. Main-process code should use
// `process.platform === 'darwin'` instead — this relies on the renderer's
// navigator and isn't available there.
export const IS_MAC = navigator.userAgent.includes('Mac')
