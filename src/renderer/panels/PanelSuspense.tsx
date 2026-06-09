// =============================================================================
// PanelSuspense — shared Suspense wrapper for lazily-loaded panel content.
//
// The lazy panel components in PANEL_REGISTRY suspend while their chunk loads;
// this wrapper renders a uniform "Loading..." fallback. The canvas-nesting
// guard (whether a canvas panel is allowed through) intentionally lives at each
// call site, so this component only owns the Suspense boundary itself.
// =============================================================================

import React, { Suspense, type ReactNode } from 'react'

export function PanelSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="w-full h-full bg-surface-4 flex items-center justify-center text-muted text-sm">Loading...</div>}>
      {children}
    </Suspense>
  )
}
