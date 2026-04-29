import { useState } from 'react'
import Whiteboard from './components/Whiteboard'
import { useNostrAuth } from '@cloistr/collab-common/auth'
import { getOrCreateDocumentId, getServiceConfig } from '@cloistr/collab-common/config'
import { Header, SharedAuthProvider, ToastProvider, LoginPrompt } from '@cloistr/ui/components'
import '@cloistr/ui/styles'
import './App.css'

// Service configuration from environment
const config = getServiceConfig()

/**
 * Main content - shows login prompt or whiteboard based on auth state
 */
function AppContent() {
  const { authState, signer } = useNostrAuth()
  const [documentId] = useState(() => getOrCreateDocumentId('whiteboard'))

  return (
    <div className="App">
      <Header activeServiceId="whiteboard" />

      {authState.isConnected && signer && authState.pubkey ? (
        <Whiteboard
          documentId={documentId}
          signer={signer}
          publicKey={authState.pubkey}
          relayUrl={config.relayUrl}
        />
      ) : (
        <LoginPrompt
          title="Cloistr Whiteboard"
          subtitle="Collaborative whiteboard powered by Nostr"
          callToAction="Sign in to create or edit whiteboards."
          style={{ height: 'calc(100vh - 60px)' }}
        />
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
