import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen, exportToBlob } from '@excalidraw/excalidraw'
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

  // Export the scene as a high-resolution PNG via Excalidraw's exportToBlob.
  //
  // Named for what it does. This was handleExportPdf with a comment claiming
  // PDF, while the body passes mimeType 'image/png' and saves a .png file. The
  // menu label was already correct, so only the identifier and comment lied —
  // harmless at runtime, and exactly the kind of thing that sends the next
  // person looking for a PDF code path that does not exist.
  const handleExportHighResPng = useCallback(async () => {
    if (!excalidrawAPI) return
    try {
      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const blob = await exportToBlob({
        elements,
        appState,
        files: excalidrawAPI.getFiles(),
        mimeType: 'image/png', // exportToBlob doesn't support PDF natively; PNG is lossless
        getDimensions: () => ({ width: 2480, height: 3508 }), // A4 at 300dpi
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${documentId}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[Whiteboard] Export failed:', error)
    }
  }, [excalidrawAPI, documentId])

  // Create ExcalidrawBinding when API is ready
  useEffect(() => {
    // Wait for BOTH the Excalidraw API and the provider: y-excalidraw's binding
    // dereferences `awareness.getStates()` unguarded, so passing undefined
    // crashed ("this.awareness is undefined"). Pass the provider's awareness.
    if (!excalidrawAPI || !provider) return

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

  // Abbreviated labels for the status bar: keep the bar to one line on mobile.
  // The full documentId is long (e.g. "whiteboard-abc123-def456"); truncate after
  // 20 chars so it doesn't push the bar to a second line at 375px.
  const docLabel = documentId.length > 20 ? `${documentId.slice(0, 20)}...` : documentId
  const userLabel = publicKey ? publicKey.slice(0, 8) + '...' : ''

  const saveLabel = persistenceState.saving
    ? 'Saving...'
    : persistenceState.dirty
    ? 'Save'
    : 'Saved'

  return (
    /*
     * Layout: flex column filling the space allocated by App's flex column.
     *
     * Before this fix the container had `paddingTop:'50px'` and
     * `height:'calc(100vh - 50px)'`. The header is sticky (not fixed) so it
     * occupies its natural height in the flow. The App div is now a flex
     * column; this container gets flex:1 from App.css and must be a flex
     * column itself so the Excalidraw canvas and the status bar stack
     * vertically without overlap.
     *
     * The status bar was previously `position:fixed bottom:0`, which overlaid
     * the Excalidraw bottom toolbar and caused Excalidraw's bottom bar to be
     * invisible (the two elements share the same z-plane at the viewport
     * bottom). Moving it into the flex column puts it below the canvas in
     * normal flow, with no z-fighting and no height assumptions.
     */
    <div className="whiteboard-container">
      {/* Canvas area: flex:1 + min-height:0 lets Excalidraw fill without
          leaking outside the container when the status bar shrinks the total
          available height. */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          excalidrawAPI={handleAPIReady}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              export: {
                // Re-enabled: data portability is a stated Cloistr principle.
                // Previously set to false, which blocked .excalidraw / SVG export.
                saveFileToDisk: true,
              },
            },
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            <MainMenu.Item onSelect={handleExportHighResPng}>
              Export as PNG (high-res)
            </MainMenu.Item>
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
      </div>

      {/*
       * Status bar: in-flow at the bottom of the flex column.
       *
       * Previously position:fixed bottom:0. On mobile at 375px that caused
       * two problems:
       *  1. Flex wrapping made it 101px tall, eating canvas space.
       *  2. It overlaid the Excalidraw bottom toolbar, hiding all mobile tools.
       *
       * Fix: in-flow flex row with flex-wrap:nowrap. Text items get
       * overflow:hidden + text-overflow:ellipsis so they truncate rather than
       * wrap. The button is flex-shrink:0 so it never disappears. Height is
       * implicitly ~40px (line-height 1.5 at 0.875rem + 0.5rem vertical padding).
       */}
      <div
        style={{
          flexShrink: 0,
          padding: '0.25rem 0.75rem',
          backgroundColor: 'var(--cloistr-bg-elevated)',
          borderTop: '1px solid var(--cloistr-border)',
          fontSize: '0.8125rem',
          color: 'var(--cloistr-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'nowrap',
          minWidth: 0,
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        <span
          style={{
            flex: '1 1 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {docLabel}{userLabel ? ` · ${userLabel}` : ''}
        </span>
        <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {isConnected ? '🟢' : '🔴'}
          {' '}{peerCount + 1}p
          {' · '}
          {persistenceState.loading ? '⏳' :
           persistenceState.saving ? '💾' :
           persistenceState.lastSave ? `✓ ${new Date(persistenceState.lastSave.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
           '○'}
        </span>
        <button
          onClick={handleSave}
          disabled={!persistenceState.initialized || persistenceState.saving || !persistenceState.dirty}
          style={{
            flexShrink: 0,
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            border: '1px solid var(--cloistr-border)',
            borderRadius: '0.25rem',
            backgroundColor: persistenceState.dirty ? 'var(--cloistr-info)' : 'var(--cloistr-success)',
            color: 'white',
            cursor: persistenceState.dirty ? 'pointer' : 'default',
            opacity: (!persistenceState.initialized || persistenceState.saving || !persistenceState.dirty) ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

export default Whiteboard
