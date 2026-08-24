/**
 * Behavioural tests for signer-resilience wiring in AppContent.
 *
 * These tests verify that a signer failure (relay drop, missed approval, failed
 * save) surfaces SignerRecovery rather than LoginPrompt or any credential UI.
 * They also confirm that the session-intact reassurance message is present.
 *
 * Test environment: jsdom + React Testing Library.
 * Assertion style: source-level + DOM, not visual.
 *
 * WHAT IS TESTED
 *
 *  1. When auth state transitions connected → disconnected (relay drop), the
 *     app shows SignerRecovery, not LoginPrompt. "You are still signed in."
 *     must be visible.
 *  2. The SignerRecovery panel contains neither a password field nor an email
 *     input. There must be no credential prompt of any kind.
 *  3. When a signing operation fails and onSignerError is invoked, the
 *     Whiteboard re-renders with the recovery panel.
 *
 * WHAT IS ASSERTED AS SOURCE-LEVEL (not DOM)
 *
 *  - withSignerRetry is imported and called in Whiteboard.tsx's handleSave
 *    (the signerRetry.ts retry logic is tested by @cloistr/ui's own test suite;
 *    this test verifies the import and call-site are present in the source).
 *  - onSignerError is wired from Whiteboard to AppContent (source trace in the
 *    report covers this for a human reviewer).
 *
 * MOCK STRATEGY
 *
 *  SharedAuthProvider, ToastProvider, ThemeProvider are bypassed: we render
 *  only AppContent after injecting a controlled authState via vi.mock on
 *  @cloistr/auth. The collab-common config and Whiteboard are mocked so they
 *  do not need a real relay or Excalidraw canvas.
 *
 *  @cloistr/ui components are NOT mocked — we use the real SignerRecovery and
 *  LoginPrompt so the assertion "You are still signed in." is meaningful.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Source-level assertions (verified before any DOM test runs)
// ---------------------------------------------------------------------------

const srcDir = join(__dirname, '..')

function readSrc(relative: string) {
  return readFileSync(join(srcDir, relative), 'utf-8')
}

describe('signer-resilience: source-level wiring', () => {
  it('Whiteboard.tsx imports withSignerRetry from @cloistr/ui', () => {
    const src = readSrc('components/Whiteboard.tsx')
    expect(src).toContain("from '@cloistr/ui'")
    expect(src).toContain('withSignerRetry')
  })

  it('Whiteboard.tsx calls withSignerRetry wrapping persistenceControls.save', () => {
    const src = readSrc('components/Whiteboard.tsx')
    // The wrapping must appear together: withSignerRetry( …save… )
    expect(src).toContain('withSignerRetry(() => persistenceControls.save())')
  })

  it('Whiteboard.tsx accepts and invokes onSignerError prop', () => {
    const src = readSrc('components/Whiteboard.tsx')
    expect(src).toContain('onSignerError')
    expect(src).toContain('onSignerError?.(error)')
  })

  it('App.tsx imports SignerRecovery from @cloistr/ui/components', () => {
    const src = readSrc('App.tsx')
    expect(src).toContain('SignerRecovery')
    expect(src).toContain("from '@cloistr/ui/components'")
  })

  it('App.tsx passes onSignerError to Whiteboard', () => {
    const src = readSrc('App.tsx')
    expect(src).toContain('onSignerError={handleSignerError}')
  })

  it('App.tsx renders SignerRecovery for transient disconnects (wasConnectedRef guard)', () => {
    const src = readSrc('App.tsx')
    expect(src).toContain('wasConnectedRef.current')
    expect(src).toContain('SignerRecovery')
  })

  it('useRelayReconnect local shim exists and is wired in App.tsx', () => {
    const hook = readSrc('hooks/useRelayReconnect.ts')
    expect(hook).toContain('visibilitychange')
    expect(hook).toContain('online')

    const app = readSrc('App.tsx')
    expect(app).toContain('useRelayReconnect')
  })
})

// ---------------------------------------------------------------------------
// DOM-level behavioural tests
// ---------------------------------------------------------------------------

// Mock @cloistr/auth so we can control authState without a real signer.
// We keep a mutable `mockAuthState` that tests can swap via `setMockAuthState`.

type MockAuthState = {
  isConnected: boolean
  isConnecting: boolean
  pubkey?: string | null
  method?: string
}

let mockAuthState: MockAuthState = {
  isConnected: false,
  isConnecting: false,
  pubkey: null,
  method: undefined,
}

const mockSigner = {
  getPublicKey: vi.fn().mockResolvedValue('aabbcc'),
  signEvent: vi.fn().mockResolvedValue({}),
}

vi.mock('@cloistr/auth', () => ({
  useNostrAuth: () => ({
    authState: mockAuthState,
    signer: mockAuthState.isConnected ? mockSigner : null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock @cloistr/collab-common/config so we don't need env vars.
vi.mock('@cloistr/collab-common/config', () => ({
  getOrCreateDocumentId: () => 'test-doc-id',
  getServiceConfig: () => ({ relayUrl: 'wss://relay.test' }),
}))

// Mock Whiteboard so it doesn't need Excalidraw/yjs/real relay. It renders a
// sentinel data-testid and exposes a button to fire onSignerError.
vi.mock('../components/Whiteboard', () => ({
  default: ({ onSignerError }: { onSignerError?: (err: unknown) => void }) => (
    <div data-testid="whiteboard-canvas">
      <button
        data-testid="trigger-signer-error"
        onClick={() => {
          const err = Object.assign(new Error('CONNECTION_FAILED'), { code: 'CONNECTION_FAILED' })
          onSignerError?.(err)
        }}
      >
        Trigger signer error
      </button>
    </div>
  ),
}))

// Mock @cloistr/ui components that need a DOM environment we haven't set up
// (Header uses ServiceMenu which references localStorage; SharedAuthProvider
// runs SSO bootstrap). We keep SignerRecovery and LoginPrompt real so the
// assertions on their text are meaningful.
vi.mock('@cloistr/ui/components', async (importOriginal) => {
  const real = await importOriginal<typeof import('@cloistr/ui/components')>()
  return {
    ...real,
    Header: () => <header data-testid="app-header" />,
    SharedAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Spinner: () => <div data-testid="spinner" />,
  }
})

// Silence the styles import.
vi.mock('@cloistr/ui/styles', () => ({}))

// Mock the local useRelayReconnect shim so it does not register event
// listeners that would persist across tests.
vi.mock('../hooks/useRelayReconnect', () => ({
  useRelayReconnect: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import App (after mocks are registered)
// ---------------------------------------------------------------------------

// Using a dynamic import via a factory helper to get the component AFTER all
// vi.mock calls are hoisted and evaluated.
import React from 'react'
let AppContent: React.FC

beforeEach(async () => {
  vi.resetModules()
  // Re-import to pick up the mocks registered above.
  const mod = await import('../App')
  // App is the default export; we need AppContent which is not exported.
  // Instead we test through App's render output, which includes AppContent.
  AppContent = mod.default
})

afterEach(() => {
  vi.clearAllMocks()
})

function setMockAuthState(state: MockAuthState) {
  mockAuthState = state
}

describe('signer-resilience: DOM behavioural', () => {
  it('shows LoginPrompt when never connected', async () => {
    setMockAuthState({ isConnected: false, isConnecting: false })
    render(<AppContent />)
    // LoginPrompt renders "Sign in to create or edit whiteboards." as its CTA.
    expect(screen.getByText('Sign in to create or edit whiteboards.')).toBeInTheDocument()
    expect(screen.queryByTestId('whiteboard-canvas')).toBeNull()
    // Must not show a credential prompt
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
  })

  it('shows Whiteboard when connected', async () => {
    setMockAuthState({ isConnected: true, isConnecting: false, pubkey: 'aabbcc', method: 'nip46' })
    render(<AppContent />)
    expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument()
    expect(screen.queryByText('Sign in to create or edit whiteboards.')).toBeNull()
  })

  it('shows SignerRecovery (not LoginPrompt) on transient disconnect after being connected', async () => {
    // Start connected.
    setMockAuthState({ isConnected: true, isConnecting: false, pubkey: 'aabbcc', method: 'nip46' })
    const { rerender } = render(<AppContent />)
    expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument()

    // Simulate relay drop: auth state goes to disconnected.
    setMockAuthState({ isConnected: false, isConnecting: false })
    await act(async () => {
      rerender(<AppContent />)
    })

    // Must show recovery, not login.
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('You are still signed in.')).toBeInTheDocument()
    // LoginPrompt's CTA must not be visible.
    expect(screen.queryByText('Sign in to create or edit whiteboards.')).toBeNull()

    // Must not show a credential prompt.
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
  })

  it('shows SignerRecovery when onSignerError is invoked from Whiteboard', async () => {
    setMockAuthState({ isConnected: true, isConnecting: false, pubkey: 'aabbcc', method: 'nip46' })
    const user = userEvent.setup()
    render(<AppContent />)
    expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument()

    // Trigger a signing failure from inside the (mocked) Whiteboard.
    await user.click(screen.getByTestId('trigger-signer-error'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('You are still signed in.')).toBeInTheDocument()

    // Must not ask for credentials.
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
  })

  it('recovery panel offers Retry and Go back buttons', async () => {
    setMockAuthState({ isConnected: true, isConnecting: false, pubkey: 'aabbcc', method: 'nip46' })
    const user = userEvent.setup()
    render(<AppContent />)

    await user.click(screen.getByTestId('trigger-signer-error'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByText('Go back')).toBeInTheDocument()
  })

  it('Retry clears the recovery panel when still connected', async () => {
    setMockAuthState({ isConnected: true, isConnecting: false, pubkey: 'aabbcc', method: 'nip46' })
    const user = userEvent.setup()
    render(<AppContent />)

    await user.click(screen.getByTestId('trigger-signer-error'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Click Retry — since auth state is still connected, whiteboard returns.
    await user.click(screen.getByText('Try again'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument()
  })

  it('Go back shows LoginPrompt (user chose to leave)', async () => {
    setMockAuthState({ isConnected: true, isConnecting: false, pubkey: 'aabbcc', method: 'nip46' })
    const user = userEvent.setup()
    render(<AppContent />)

    await user.click(screen.getByTestId('trigger-signer-error'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Simulate disconnect happening while recovery panel is shown.
    setMockAuthState({ isConnected: false, isConnecting: false })
    // Click Go back — resets wasConnectedRef, so LoginPrompt is shown.
    await user.click(screen.getByText('Go back'))

    // Recovery panel gone; login prompt now shown (user chose to leave).
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Sign in to create or edit whiteboards.')).toBeInTheDocument()
  })
})
