import { useState } from 'react'
import Whiteboard from './components/Whiteboard'
import { useNostrAuth } from '@cloistr/collab-common/auth'
import { Header, SharedAuthProvider, ToastProvider } from '@cloistr/ui/components'
import '@cloistr/ui/styles'
import './App.css'

// Default relay for Yjs sync
const DEFAULT_RELAY_URL = import.meta.env.VITE_RELAY_URL || 'wss://relay.cloistr.xyz'

/**
 * Get or generate document ID.
 * Uses URL parameter if provided, otherwise generates a new one.
 * Format: {type}-{timestamp}-{random} (e.g., whiteboard-1711392000-a1b2c3)
 */
function getDocumentId(): string {
  const params = new URLSearchParams(window.location.search)
  const urlDocId = params.get('docId')

  if (urlDocId) {
    return urlDocId
  }

  // Generate a new document ID and update URL
  const newDocId = `whiteboard-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const newUrl = new URL(window.location.href)
  newUrl.searchParams.set('docId', newDocId)
  window.history.replaceState({}, '', newUrl.toString())

  return newDocId
}

/**
 * Main content - shows login prompt or whiteboard based on auth state
 */
function AppContent() {
  const { authState, signer } = useNostrAuth()
  const [documentId] = useState(getDocumentId)

  return (
    <div className="App">
      <Header activeServiceId="whiteboard" />

      {authState.isConnected && signer && authState.pubkey ? (
        <Whiteboard
          documentId={documentId}
          signer={signer}
          publicKey={authState.pubkey}
          relayUrl={DEFAULT_RELAY_URL}
        />
      ) : (
        <div className="login-prompt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Welcome to Cloistr Whiteboard</h2>
            <p>Collaborative whiteboard powered by Nostr</p>
            <p>Sign in to create or edit whiteboards.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <SharedAuthProvider>
      <AppContent />
    </SharedAuthProvider>
    </ToastProvider>
  )
}

export default App
