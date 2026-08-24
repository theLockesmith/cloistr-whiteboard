import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen, exportToBlob } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types'
import * as Y from 'yjs'
import { ExcalidrawBinding, yjsToExcalidraw } from 'y-excalidraw'
import { NostrSyncProvider, useDocumentPersistence } from '@cloistr/collab-common'
import { generateDocumentId } from '@cloistr/collab-common/config'
import { generateUserColor } from '@cloistr/collab-common/presence'
import type { SignerInterface } from '@cloistr/auth'
import { withSignerRetry, useToast } from '@cloistr/ui'
import { TEMPLATES } from '../templates'
import type { WhiteboardTemplate } from '../templates'

// For development, use VITE_BLOSSOM_URL env var or fall back to public server
// Production uses files.cloistr.xyz with platform auth
const BLOSSOM_URL = import.meta.env.VITE_BLOSSOM_URL || 'https://nostr.download'

function pickCollabColor(pubkey: string): { color: string; light: string } {
  const generatedHex = generateUserColor(pubkey)
  return {
    color: generatedHex,
    light: generatedHex + '33',
  }
}

interface WhiteboardProps {
  signer: SignerInterface
  publicKey: string
  relayUrl: string
  documentId: string
  onSignerError?: (err: unknown) => void
}

const Whiteboard: React.FC<WhiteboardProps> = ({ documentId, signer, publicKey, relayUrl, onSignerError }) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [ydoc] = useState(() => new Y.Doc())
  const [yElements] = useState(() => ydoc.getArray<Y.Map<any>>('elements'))
  const [yAssets] = useState(() => ydoc.getMap('assets'))
  const [isConnected, setIsConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const bindingRef = useRef<ExcalidrawBinding | null>(null)
  const providerRef = useRef<NostrSyncProvider | null>(null)
  const [provider, setProvider] = useState<NostrSyncProvider | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()

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

    const { color, light } = pickCollabColor(publicKey)
    const displayName = `User ${publicKey.slice(0, 6)}`
    syncProvider.awareness.setLocalStateField('user', {
      name: displayName,
      color,
      colorLight: light,
    })

    return () => {
      syncProvider.destroy()
      providerRef.current = null
      setProvider(null)
    }
  }, [documentId, ydoc, signer, relayUrl, publicKey])

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
      // withSignerRetry retries retryable errors up to 3x with backoff+jitter.
      // User denials (CANCELLED, REMOTE_ERROR) rethrow immediately.
      await withSignerRetry(() => persistenceControls.save())
    } catch (error) {
      console.error('[Whiteboard] Save failed:', error)
      onSignerError?.(error)
    }
  }, [persistenceControls, onSignerError])

  // Ctrl+S: registered in capture phase so it fires before Excalidraw's own
  // handlers on the canvas element.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (persistenceState.initialized && !persistenceState.saving && persistenceState.dirty) {
          handleSave()
        }
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [handleSave, persistenceState.initialized, persistenceState.saving, persistenceState.dirty])

  // Export PNG (A4 at 300 dpi)
  const handleExportHighResPng = useCallback(async () => {
    if (!excalidrawAPI) return
    try {
      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const blob = await exportToBlob({
        elements,
        appState,
        files: excalidrawAPI.getFiles(),
        mimeType: 'image/png',
        getDimensions: () => ({ width: 2480, height: 3508 }),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${documentId}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[Whiteboard] PNG export failed:', error)
    }
  }, [excalidrawAPI, documentId])

  // Export SVG
  const handleExportSvg = useCallback(async () => {
    if (!excalidrawAPI) return
    try {
      const { exportToSvg } = await import('@excalidraw/excalidraw')
      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const svg = await exportToSvg({
        elements,
        appState,
        files: excalidrawAPI.getFiles(),
        exportPadding: 16,
      })
      const svgString = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${documentId}.svg`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[Whiteboard] SVG export failed:', error)
    }
  }, [excalidrawAPI, documentId])

  // Load template into the current scene
  const handleLoadTemplate = useCallback((template: WhiteboardTemplate) => {
    if (!excalidrawAPI) return
    excalidrawAPI.updateScene({ elements: template.elements as any })
    if (template.elements.length > 0) {
      excalidrawAPI.scrollToContent(undefined, { animate: true, fitToContent: true })
    }
  }, [excalidrawAPI])

  // New Board: navigate to a URL with a fresh docId.
  // getOrCreateDocumentId stores the board ID as ?docId=... so navigating to
  // a new docId gives a clean board with full React init.
  const handleNewBoard = useCallback(() => {
    if (!window.confirm(
      'Start a new board?\n\nYour current board stays available at this URL — copy the link from Share > Copy Board Link first if you need it.',
    )) return
    const newId = generateDocumentId('whiteboard')
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('docId', newId)
    window.location.href = newUrl.toString()
  }, [])

  // Copy current URL (includes ?docId=...) so collaborators can open the
  // same board by pasting the link.
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toastSuccess('Board link copied to clipboard')
    } catch {
      // Clipboard API unavailable (non-HTTPS or permission denied).
      toastError('Could not copy — copy the link from the address bar manually')
    }
  }, [toastSuccess, toastError])

  // Create ExcalidrawBinding when API is ready.
  // y-excalidraw dereferences awareness.getStates() unguarded, so both
  // excalidrawAPI and provider must exist before creating the binding.
  useEffect(() => {
    if (!excalidrawAPI || !provider) return

    const binding = new ExcalidrawBinding(
      yElements,
      yAssets,
      excalidrawAPI,
      provider.awareness
    )

    bindingRef.current = binding
    console.log('[Whiteboard] ExcalidrawBinding created')

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

  const canSave =
    persistenceState.initialized &&
    !persistenceState.saving &&
    !!persistenceState.dirty

  // ---- Status bar labels ---------------------------------------------------
  const docLabel = documentId.length > 20 ? `${documentId.slice(0, 20)}...` : documentId
  const userLabel = publicKey ? publicKey.slice(0, 8) + '...' : ''

  const saveLabel = persistenceState.saving
    ? 'Saving...'
    : persistenceState.dirty
    ? 'Save'
    : 'Saved'

  return (
    <div className="whiteboard-container">

      {/* Canvas area: flex:1 + min-height:0 lets Excalidraw fill without
          leaking outside the container. */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          excalidrawAPI={handleAPIReady}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              export: {
                saveFileToDisk: true,
              },
            },
          }}
        >
          {/*
           * Cloistr-specific items live here alongside Excalidraw's own canvas
           * controls. No standalone menu bar sits above the canvas — one
           * navigation system, zero chrome waste.
           */}
          <MainMenu>
            <MainMenu.Group title="Board">
              <MainMenu.Item onSelect={handleNewBoard}>New Board</MainMenu.Item>
            </MainMenu.Group>
            <MainMenu.Separator />
            <MainMenu.Group title="Export">
              <MainMenu.Item onSelect={handleExportHighResPng}>Export PNG (A4, 300 dpi)</MainMenu.Item>
              <MainMenu.Item onSelect={handleExportSvg}>Export SVG</MainMenu.Item>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.Export />
            </MainMenu.Group>
            <MainMenu.Separator />
            <MainMenu.Group title="Templates">
              {TEMPLATES.map(t => (
                <MainMenu.Item key={t.id} onSelect={() => handleLoadTemplate(t)}>
                  {t.emoji} {t.name}
                </MainMenu.Item>
              ))}
            </MainMenu.Group>
            <MainMenu.Separator />
            <MainMenu.Group title="Share">
              <MainMenu.Item onSelect={handleCopyLink}>Copy Board Link</MainMenu.Item>
            </MainMenu.Group>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.Separator />
            <MainMenu.ItemCustom>
              <span style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                {' · '}{peerCount + 1} online
              </span>
            </MainMenu.ItemCustom>
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
          disabled={!canSave}
          style={{
            flexShrink: 0,
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid var(--cloistr-border)',
            borderRadius: '0.25rem',
            backgroundColor: persistenceState.dirty ? 'var(--cloistr-info)' : 'var(--cloistr-success)',
            color: 'white',
            cursor: persistenceState.dirty ? 'pointer' : 'default',
            opacity: !canSave ? 0.5 : 1,
            whiteSpace: 'nowrap',
            minHeight: '44px',
          }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

export default Whiteboard
