import { useState } from 'react'
import Whiteboard from './components/Whiteboard'
import { useNostrAuth } from '@cloistr/auth'
import { getOrCreateDocumentId, getServiceConfig } from '@cloistr/collab-common/config'
import { Header, SharedAuthProvider, ToastProvider, LoginPrompt, Spinner, ThemeProvider } from '@cloistr/ui/components'
import '@cloistr/ui/styles'
import './App.css'

// Service configuration from environment
const config = getServiceConfig()

/**
 * Main content - shows login prompt or whiteboard based on auth state.
 *
 * Three visual states:
 *  1. isConnected + signer + pubkey  → Whiteboard
 *  2. isConnecting (NIP-46 handshake in progress, no login prompt yet) → spinner
 *  3. not connected, not connecting  → LoginPrompt (user action required)
 *
 * State 2 plugs the 18-second blank: SharedAuthProvider's gateRestore covers
 * the first ~12 s via its own spinner, but releases at its safety cap even when
 * the NIP-46 handshake is still completing. Without a connecting indicator here,
 * users see "Sign in" for however long the handshake still needs after the cap.
 */
function AppContent() {
  const { authState, signer } = useNostrAuth()
  const [documentId] = useState(() => getOrCreateDocumentId('whiteboard'))

  const content = (() => {
    if (authState.isConnected && signer && authState.pubkey) {
      return (
        <Whiteboard
          documentId={documentId}
          signer={signer}
          publicKey={authState.pubkey}
          relayUrl={config.relayUrl}
        />
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
      /* height restored: the old markup passed calc(100vh - 60px). Without it
         LoginPrompt resolves to 100vh inside the flex column and renders about
         30px below the visual centre of the space actually available. */
      <LoginPrompt
        style={{ height: 'calc(100vh - 60px)' }}
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
