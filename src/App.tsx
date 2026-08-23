import { useState, useCallback, useEffect, useRef } from 'react'
import Whiteboard from './components/Whiteboard'
import { useNostrAuth } from '@cloistr/auth'
import { getOrCreateDocumentId, getServiceConfig } from '@cloistr/collab-common/config'
import { Header, SharedAuthProvider, ToastProvider, LoginPrompt, Spinner, ThemeProvider, SignerRecovery } from '@cloistr/ui/components'
import '@cloistr/ui/styles'
import { useRelayReconnect } from './hooks/useRelayReconnect'
import './App.css'

// Service configuration from environment
const config = getServiceConfig()

/**
 * Main content - shows login prompt or whiteboard based on auth state.
 *
 * Five visual states:
 *  1. isConnected + signer + pubkey, no signerError  → Whiteboard
 *  2. isConnecting (NIP-46 handshake in progress, no login prompt yet) → spinner
 *  3. signerError set (save failed after retries, or transient disconnect)
 *                                                    → SignerRecovery
 *  4. was previously connected, now disconnected (transient drop detected)
 *                                                    → SignerRecovery
 *  5. not connected, not connecting, never was       → LoginPrompt
 *
 * State 2 plugs the 18-second blank: SharedAuthProvider's gateRestore covers
 * the first ~12 s via its own spinner, but releases at its safety cap even when
 * the NIP-46 handshake is still completing. Without a connecting indicator here,
 * users see "Sign in" for however long the handshake still needs after the cap.
 *
 * States 3 and 4 are the signer-resilience additions. A transient relay hiccup
 * or a failed save MUST NOT route the user to a credential prompt. The session
 * is still valid; only the signer connection was temporarily unreachable.
 *
 * SIGNER-RESILIENCE DESIGN (4 parts)
 *
 *  1. Never destroy session state on a signing failure. → enforced here by
 *     checking wasConnectedRef before showing LoginPrompt.
 *  2. Bounded retry with backoff/jitter for the retryable class only. →
 *     withSignerRetry in Whiteboard.handleSave.
 *  3. SignerRecovery screen: session intact, Retry + Go Back, no credential
 *     prompt. → states 3 and 4 above.
 *  4. Reconnect on visibilitychange (phone app-switcher, file picker, screen
 *     lock). → useRelayReconnect below. Local shim because @cloistr/ui 0.26.0
 *     does not export it; SharedAuthProvider in ^0.27.0 wires it automatically
 *     so this shim can be dropped once the registry catches up.
 *
 * SITES THAT PREVIOUSLY DROPPED TO LOGIN
 *
 *  App.tsx: the else-branch (state 5 below) was the only path. There was no
 *  check for whether the user was previously connected. Any auth-state
 *  transition from connected → disconnected — including relay drops and missed
 *  NIP-46 approvals — fell straight through to LoginPrompt, which reads to the
 *  user as "this app randomly logged me out". Fixed by states 3 and 4.
 *
 * No other session-clearing or login-redirect code exists in this repo.
 * Whiteboard.tsx's syncProvider.onError and .onDisconnect update the Yjs
 * relay's internal connected flag; they do not touch authState and never did.
 */
function AppContent() {
  const { authState, signer } = useNostrAuth()
  const [documentId] = useState(() => getOrCreateDocumentId('whiteboard'))
  const [signerError, setSignerError] = useState<unknown>(null)
  const [retrying, setRetrying] = useState(false)

  // Track whether the user established a session in this page load. Used to
  // distinguish a transient relay drop (show SignerRecovery) from a genuine
  // "never connected" state (show LoginPrompt).
  const wasConnectedRef = useRef(false)

  // Part 4: reconnect relay WebSockets on visibilitychange / online — before
  // the user next acts. Local shim since @cloistr/ui 0.26.0 does not export
  // useRelayReconnect; drop this and its import when ^0.27.0 is on the registry
  // (SharedAuthProvider will wire it automatically at that version).
  useRelayReconnect(signer ?? null, authState)

  // Once connected, remember it. Clear the error so the whiteboard can be
  // used immediately after a successful reconnect.
  useEffect(() => {
    if (authState.isConnected) {
      wasConnectedRef.current = true
      setSignerError(null)
    }
  }, [authState.isConnected])

  // Called by Whiteboard when a signing operation fails after all automatic
  // retries are exhausted (withSignerRetry gave up).
  const handleSignerError = useCallback((err: unknown) => {
    setSignerError(err)
  }, [])

  // Retry: clear the error and let the user try again. The whiteboard remounts
  // because we switch back to the connected state rendering path.
  const handleRetry = useCallback(() => {
    setRetrying(true)
    setSignerError(null)
    setRetrying(false)
  }, [])

  // Go back: the user wants to leave rather than retry. Treat as intentional
  // departure from the session — reset the "was connected" flag so LoginPrompt
  // is shown on the next non-connected render, which is what the user expects
  // when they explicitly choose to walk away.
  const handleGoBack = useCallback(() => {
    wasConnectedRef.current = false
    setSignerError(null)
  }, [])

  const content = (() => {
    if (authState.isConnected && signer && authState.pubkey && !signerError) {
      return (
        <Whiteboard
          documentId={documentId}
          signer={signer}
          publicKey={authState.pubkey}
          relayUrl={config.relayUrl}
          onSignerError={handleSignerError}
        />
      )
    }

    // State 3: a signing operation (e.g. save) failed after retries.
    // State 4: auth state transitioned connected → disconnected while we had a
    //          session. Both conditions show the recovery screen, never a
    //          credential prompt.
    if (signerError || (!authState.isConnected && !authState.isConnecting && wasConnectedRef.current)) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <SignerRecovery
            error={signerError ?? new Error('Relay connection lost')}
            onRetry={handleRetry}
            onGoBack={handleGoBack}
            retrying={retrying}
          />
        </div>
      )
    }

    if (authState.isConnecting) {
      return (
        <div
          aria-busy="true"
          role="status"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" label="Connecting to signer" />
          <p style={{ margin: 0, color: 'var(--cloistr-text-muted)', fontSize: '0.95rem' }}>
            Connecting to signer...
          </p>
        </div>
      )
    }

    return (
      /* height restored: the old markup passed calc(100dvh - 60px). Without it
         LoginPrompt resolves to the full dynamic-viewport-height inside the flex column and renders about
         30px below the visual centre of the space actually available. */
      <LoginPrompt
        style={{ height: 'calc(100dvh - 60px)' }}
        title="Cloistr Whiteboard"
        subtitle="Collaborative whiteboard powered by Nostr"
        callToAction="Sign in to create or edit whiteboards."
      />
    )
  })()

  return (
    <div className="App">
      <Header activeServiceId="whiteboard" />
      {content}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SharedAuthProvider>
          <AppContent />
        </SharedAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
