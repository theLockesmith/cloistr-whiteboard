import React, { useState, useEffect, useCallback } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types'
import * as Y from 'yjs'
import { NostrSyncProvider } from '@cloistr/collab-common'
import { useNostrAuth } from '../App'

interface WhiteboardProps {
  documentId: string
}

const Whiteboard: React.FC<WhiteboardProps> = ({ documentId }) => {
  const { signer, publicKey, relayUrl } = useNostrAuth()
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [ydoc] = useState(() => new Y.Doc())
  const [, setProvider] = useState<NostrSyncProvider | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)

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
    setProvider(syncProvider)

    return () => {
      syncProvider.destroy()
    }
  }, [documentId, ydoc, signer, relayUrl])

  // TODO: Add y-excalidraw integration for full sync
  // For now, changes are logged but not synced between clients
  const handleChange = useCallback((elements: readonly any[], _appState: AppState) => {
    // TODO: Sync changes via Yjs when y-excalidraw is integrated
    console.log('Whiteboard changed:', { elements: elements.length, user: publicKey?.slice(0, 8) })
  }, [publicKey])

  useEffect(() => {
    if (excalidrawAPI && isConnected) {
      console.log('[Whiteboard] Ready for collaboration:', publicKey?.slice(0, 8))
    }
  }, [excalidrawAPI, isConnected, publicKey])

  return (
    <div className="whiteboard-container" style={{ paddingTop: '50px' }}>
      <Excalidraw
        excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
        onChange={handleChange}
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
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.875rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        zIndex: 1000
      }}>
        <span>Document: {documentId}</span>
        <span>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          {' · '}
          {peerCount + 1} user{peerCount > 0 ? 's' : ''} online
        </span>
      </div>
    </div>
  )
}

export default Whiteboard
