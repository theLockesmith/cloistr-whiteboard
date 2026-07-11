import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types'
import * as Y from 'yjs'
import { ExcalidrawBinding, yjsToExcalidraw } from 'y-excalidraw'
import { NostrSyncProvider, useDocumentPersistence } from '@cloistr/collab-common'
import type { SignerInterface } from '@cloistr/auth'

// For development, use VITE_BLOSSOM_URL env var or fall back to public server
// Production uses files.cloistr.xyz with platform auth
const BLOSSOM_URL = import.meta.env.VITE_BLOSSOM_URL || 'https://nostr.download'

interface WhiteboardProps {
  signer: SignerInterface
  publicKey: string
  relayUrl: string
  documentId: string
}

const Whiteboard: React.FC<WhiteboardProps> = ({ documentId, signer, publicKey, relayUrl }) => {
  // signer, publicKey, relayUrl passed as props
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [ydoc] = useState(() => new Y.Doc())
  const [yElements] = useState(() => ydoc.getArray<Y.Map<any>>('elements'))
  const [yAssets] = useState(() => ydoc.getMap('assets'))
  const [isConnected, setIsConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const bindingRef = useRef<ExcalidrawBinding | null>(null)
  const providerRef = useRef<NostrSyncProvider | null>(null)
  const [provider, setProvider] = useState<NostrSyncProvider | null>(null)

  // Initialize NostrSyncProvider
  useEffect(() => {
    const syncProvider = new NostrSyncProvider(ydoc, {
      signer,
      relayUrl,
      docId: documentId,
    })

    syncProvider.onConnect = () => {
      console.log('[Whiteboard] Connected to relay')
      setIsConnected(true)
    }

    syncProvider.onDisconnect = () => {
      console.log('[Whiteboard] Disconnected from relay')
      setIsConnected(false)
    }

    syncProvider.onPeersChange = (count: number) => {
      console.log(`[Whiteboard] Peer count: ${count}`)
      setPeerCount(count)
    }

    syncProvider.onError = (error: Error) => {
      console.error('[Whiteboard] Sync error:', error)
    }

    syncProvider.connect().catch(console.error)
    providerRef.current = syncProvider
    setProvider(syncProvider)

    return () => {
      syncProvider.destroy()
      providerRef.current = null
      setProvider(null)
    }
  }, [documentId, ydoc, signer, relayUrl])

  // Document persistence via Blossom
  const [persistenceState, persistenceControls] = useDocumentPersistence(
    ydoc,
    {
      documentId,
      blossomUrl: BLOSSOM_URL,
      relayUrl,
      signer,
    },
    {
      autoLoad: true,
      autoSaveInterval: 60000,
    }
  )

  const handleSave = useCallback(async () => {
    try {
      await persistenceControls.save()
    } catch (error) {
      console.error('[Whiteboard] Save failed:', error)
    }
  }, [persistenceControls])

  // Create ExcalidrawBinding when API is ready
  useEffect(() => {
    // Wait for BOTH the Excalidraw API and the provider: y-excalidraw's binding
    // dereferences `awareness.getStates()` unguarded, so passing undefined
    // crashed ("this.awareness is undefined"). Pass the provider's awareness.
    if (!excalidrawAPI || !provider) return

    // Create the binding between Yjs and Excalidraw
    const binding = new ExcalidrawBinding(
      yElements,
      yAssets,
      excalidrawAPI,
      provider.awareness
    )

    bindingRef.current = binding
    console.log('[Whiteboard] ExcalidrawBinding created')

    // Load initial state from Yjs if it exists
    if (yElements.length > 0) {
      const elements = yjsToExcalidraw(yElements)
      excalidrawAPI.updateScene({ elements })
      console.log('[Whiteboard] Loaded', elements.length, 'elements from Yjs')
    }

    return () => {
      binding.destroy()
      bindingRef.current = null
      console.log('[Whiteboard] ExcalidrawBinding destroyed')
    }
  }, [excalidrawAPI, yElements, yAssets, provider])

  const handleAPIReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api)
    console.log('[Whiteboard] Excalidraw API ready')
  }, [])

  return (
    <div className="whiteboard-container" style={{ paddingTop: '50px', height: 'calc(100vh - 50px)' }}>
      <Excalidraw
        excalidrawAPI={handleAPIReady}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: true,
            export: {
              saveFileToDisk: false,
            },
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Item onSelect={() => {}}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            {' · '}{peerCount + 1} online
          </MainMenu.Item>
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>
              Cloistr Whiteboard
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemLoadScene />
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>

      {/* Status bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0.5rem 1rem',
        backgroundColor: 'var(--cloistr-bg-elevated)',
        borderTop: '1px solid var(--cloistr-border)',
        fontSize: '0.875rem',
        color: 'var(--cloistr-text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <span>
          Document: {documentId}
          {publicKey && ` · User: ${publicKey.slice(0, 8)}...`}
        </span>
        <span>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          {' · '}
          {peerCount + 1} user{peerCount > 0 ? 's' : ''} collaborating
          {' · '}
          {persistenceState.loading ? '⏳ Loading...' :
           persistenceState.saving ? '💾 Saving...' :
           persistenceState.lastSave ? `✓ Saved ${new Date(persistenceState.lastSave.timestamp).toLocaleTimeString()}` :
           '○ Not saved'}
        </span>
        <button
          onClick={handleSave}
          disabled={!persistenceState.initialized || persistenceState.saving || !persistenceState.dirty}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            border: '1px solid var(--cloistr-border)',
            borderRadius: '0.25rem',
            backgroundColor: persistenceState.dirty ? 'var(--cloistr-info)' : 'var(--cloistr-success)',
            color: 'white',
            cursor: persistenceState.dirty ? 'pointer' : 'default',
            opacity: (!persistenceState.initialized || persistenceState.saving || !persistenceState.dirty) ? 0.5 : 1,
          }}
        >
          {persistenceState.saving ? 'Saving...' : persistenceState.dirty ? 'Save' : 'Saved'}
        </button>
      </div>
    </div>
  )
}

export default Whiteboard
