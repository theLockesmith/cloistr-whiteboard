import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

/**
 * Why this exists.
 *
 * Whiteboard mounts the Excalidraw canvas only after the board has LOADED, and
 * every save path goes through handleSave's load gate. Without the first, a
 * board that failed to load shows a blank canvas somebody can draw on and
 * save over the real board; without the second, Ctrl+S during a load attempts
 * a save. Review asked for a test that fails if EITHER guard is removed.
 *
 * Excalidraw is mocked to a marker element. The 'loaded' cases prove the
 * marker and the save path are live, so the negative assertions mean
 * something.
 */

const h = vi.hoisted(() => {
  // A stub that absorbs any property access, call or construction.
  const deepStub = (): any =>
    new Proxy(function () {}, {
      get: (_t, prop) => (prop === 'then' ? undefined : deepStub()),
      apply: () => deepStub(),
      construct: () => deepStub(),
    })
  // A React component stub whose properties are component stubs too
  // (MainMenu.Group, MainMenu.DefaultItems.SaveAsImage, WelcomeScreen.Center…).
  const componentStub = (): any =>
    new Proxy(function () { return null }, {
      get: (_t, prop) => (prop === 'then' ? undefined : componentStub()),
    })
  return {
    deepStub,
    componentStub,
    toastError: vi.fn(),
    persistence: { state: {} as Record<string, unknown> },
    controls: {
      save: vi.fn(() => Promise.resolve({ hash: 'h' })),
      load: vi.fn(() => Promise.resolve({ found: false })),
      exists: vi.fn(), enableAutoSave: vi.fn(), disableAutoSave: vi.fn(),
    },
  }
})

vi.mock('@excalidraw/excalidraw', async () => {
  const React = await import('react')
  return {
    Excalidraw: () => React.createElement('div', { 'data-testid': 'excalidraw-canvas' }),
    MainMenu: h.componentStub(),
    WelcomeScreen: h.componentStub(),
    exportToBlob: vi.fn(),
  }
})
vi.mock('y-excalidraw', () => ({
  ExcalidrawBinding: class { constructor() { return h.deepStub() } },
  yjsToExcalidraw: vi.fn(() => []),
}))
vi.mock('@cloistr/collab-common', () => ({
  useDocumentPersistence: () => [h.persistence.state, h.controls],
  NostrSyncProvider: class { constructor() { return h.deepStub() } },
}))
vi.mock('@cloistr/collab-common/config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateDocumentId: vi.fn(() => 'whiteboard-generated'),
}))
vi.mock('@cloistr/collab-common/presence', () => ({ generateUserColor: () => '#000000' }))
vi.mock('@cloistr/ui', () => ({
  withSignerRetry: (fn: () => unknown) => fn(),
  useToast: () => ({ success: vi.fn(), error: h.toastError }),
}))

import Whiteboard from '../components/Whiteboard'

function stateWith(loadStatus: 'loading' | 'loaded' | 'failed', extra: Record<string, unknown> = {}) {
  const loadError = loadStatus === 'failed' ? new Error('Relay query timed out') : null
  return {
    initialized: true, loading: loadStatus === 'loading', loadStatus, loadError,
    saving: false, dirty: false, lastSave: null, error: loadError, ...extra,
  }
}

function renderBoard() {
  return render(<Whiteboard documentId="whiteboard-render-test" signer={h.deepStub()} publicKey="pk-test" relayUrl="wss://relay.test" />)
}

const saveButton = () => screen.getByRole('button', { name: 'Save board' }) as HTMLButtonElement
const pressCtrlS = () => fireEvent.keyDown(document, { key: 's', ctrlKey: true })

afterEach(() => {
  cleanup()
  h.controls.save.mockClear()
  h.toastError.mockClear()
})

describe('Whiteboard before the board has loaded', () => {
  it('does not mount the canvas, shows loading, and disables Save', () => {
    h.persistence.state = stateWith('loading')
    renderBoard()
    expect(screen.queryByTestId('excalidraw-canvas')).toBeNull()
    expect(screen.getByText('Loading board…')).toBeTruthy()
    expect(saveButton().disabled).toBe(true)
  })

  it('on a failed load shows the error, never the canvas, and disables Save', () => {
    h.persistence.state = stateWith('failed')
    renderBoard()
    expect(screen.queryByTestId('excalidraw-canvas')).toBeNull()
    expect(screen.getByRole('alert').textContent).toMatch(/could not be opened/i)
    expect(saveButton().disabled).toBe(true)
  })

  it('Ctrl+S while loading does not save, and says why', () => {
    h.persistence.state = stateWith('loading', { dirty: true })
    renderBoard()
    pressCtrlS()
    expect(h.controls.save).not.toHaveBeenCalled()
    expect(h.toastError).toHaveBeenCalledWith(expect.stringMatching(/still loading/i))
  })
})

describe('Whiteboard once the board has loaded', () => {
  it('mounts the canvas (proves the canvas assertions can fail)', () => {
    h.persistence.state = stateWith('loaded')
    renderBoard()
    expect(screen.getByTestId('excalidraw-canvas')).toBeTruthy()
  })

  it('Ctrl+S with unsaved changes saves (proves the save assertion can fail)', () => {
    h.persistence.state = stateWith('loaded', { dirty: true })
    renderBoard()
    pressCtrlS()
    expect(h.controls.save).toHaveBeenCalledTimes(1)
  })
})
