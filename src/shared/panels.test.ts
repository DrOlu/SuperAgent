import { describe, it, expect } from 'vitest'
import { resolvePanelSize, PANEL_DEFINITIONS } from './panels'
import { DEFAULT_SETTINGS, PANEL_DEFAULT_SIZES } from './types'

describe('resolvePanelSize', () => {
  it('falls back to the panel type default size when settings are absent', () => {
    expect(resolvePanelSize('editor')).toEqual(PANEL_DEFINITIONS.editor.defaultSize)
    expect(resolvePanelSize('terminal', null)).toEqual(PANEL_DEFAULT_SIZES.terminal)
  })

  it('treats the factory-default setting value as unset (keeps per-type sizes)', () => {
    // A user who never touches the setting leaves it at DEFAULT_SETTINGS, so each
    // panel type must keep its own tuned default rather than a flat shared size.
    const settings = {
      defaultPanelWidth: DEFAULT_SETTINGS.defaultPanelWidth,
      defaultPanelHeight: DEFAULT_SETTINGS.defaultPanelHeight,
    }
    expect(resolvePanelSize('terminal', settings)).toEqual(PANEL_DEFAULT_SIZES.terminal)
    expect(resolvePanelSize('browser', settings)).toEqual(PANEL_DEFAULT_SIZES.browser)
  })

  it('applies a customized width and height to every panel type', () => {
    const size = resolvePanelSize('editor', { defaultPanelWidth: 900, defaultPanelHeight: 700 })
    expect(size).toEqual({ width: 900, height: 700 })
    const term = resolvePanelSize('terminal', { defaultPanelWidth: 900, defaultPanelHeight: 700 })
    expect(term).toEqual({ width: 900, height: 700 })
  })

  it('overrides only the customized dimension, keeping the type default for the other', () => {
    // Width changed away from the default, height left at the default → width
    // wins, height falls back per-type.
    const size = resolvePanelSize('editor', {
      defaultPanelWidth: 1000,
      defaultPanelHeight: DEFAULT_SETTINGS.defaultPanelHeight,
    })
    expect(size).toEqual({ width: 1000, height: PANEL_DEFINITIONS.editor.defaultSize.height })
  })

  it('ignores a non-positive override dimension', () => {
    const size = resolvePanelSize('terminal', { defaultPanelWidth: 0, defaultPanelHeight: -50 })
    expect(size).toEqual(PANEL_DEFAULT_SIZES.terminal)
  })
})
