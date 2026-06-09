import { useEffect } from 'react'

// Capture-phase Escape-to-close for dialogs that don't go through Modal.
// While `isOpen` is true, an Escape keydown calls preventDefault and onClose.
// Capture phase matches Modal's closeOnEscape behavior so the dialog wins over
// any nested handlers.
export function useEscapeKey(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [isOpen, onClose])
}
