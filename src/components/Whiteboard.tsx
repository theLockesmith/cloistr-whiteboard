import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen, exportToBlob } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types'
import * as Y from 'yjs'
import { ExcalidrawBinding, yjsToExcalidraw } from 'y-excalidraw'
import { NostrSyncProvider, useDocumentPersistence } from '@cloistr/collab-common'
import { generateUserColor } from '@cloistr/collab-common/presence'
import type { SignerInterface } from '@cloistr/auth'
import TemplatesModal from './TemplatesModal'
import { TEMPLATES } from '../templates'
import type { WhiteboardTemplate } from '../templates'

// For development, use VITE_BLOSSOM_URL env var or fall back to public server
// Production uses files.cloistr.xyz with platform auth
const BLOSSOM_URL = import.meta.env.VITE_BLOSSOM_URL || 'https://nostr.download'

// Collaborator colors used for multiplayer cursor display.
// Picked to be visually distinct and work in both light and dark themes.

function pickCollabColor(pubkey: string): { color: string; light: string } {
  // Deterministic pick based on pubkey bytes so a given user always gets the same
  // colour. generateUserColor gives a CSS string; we need a hex pair here.
  const generatedHex = generateUserColor(pubkey)
  // Try to find a close match in our curated set, otherwise use the generated one.
  // Using the generated hex directly is always safe for the color field; light is
  // a 20%-opacity variant.
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
}

const Whiteboard: React.FC<WhiteboardProps> = ({ documentId, signer, publicKey, relayUrl }) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [ydoc] = useState(() => new Y.Doc())
  const [yElements] = useState(() => ydoc.getArray<Y.Map<any>>('elements'))
  const [yAssets] = useState(() => ydoc.getMap('assets'))
  const [isConnected, setIsConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const [showTemplates, setShowTemplates] = useState(false)
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

    // Announce ourselves to remote peers via Yjs awareness.
    //
    // y-excalidraw reads awareness states with a "user" field in the format:
    //   { name: string, color: string, colorLight: string }
    // and passes them to Excalidraw's collaborators map so remote cursors are
    // displayed with the correct label and colour. Without this the field is
    // absent and all remote cursors appear grey and anonymous.
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
      await persistenceControls.save()
    } catch (error) {
      console.error('[Whiteboard] Save failed:', error)
    }
  }, [persistenceControls])

  // Export the scene as a high-resolution PNG via Excalidraw's exportToBlob.
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
        getDimensions: () => ({ width: 2480, height: 3508 }), // A4 at 300 dpi
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

  // Export the scene as an SVG file.
  //
  // Excalidraw 0.17.x exports exportToSvg as a named export alongside
  // exportToBlob. It returns a Promise<SVGSVGElement>; we serialise to a
  // data: URI and trigger a browser download via an <a> element.
  //
  // Note: exportToSvg is imported dynamically here to keep the initial
  // bundle trim — the SVG path is rarely hit.
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

  // Load a template into the scene.
  //
  // Replaces the current scene elements with the template's elements. Uses
  // scrollToContent after update so the template is immediately visible
  // regardless of the current viewport position.
  const handleLoadTemplate = useCallback((template: WhiteboardTemplate) => {
    if (!excalidrawAPI) return
    excalidrawAPI.updateScene({ elements: template.elements as any })
    if (template.elements.length > 0) {
      excalidrawAPI.scrollToContent(undefined, { animate: true, fitToContent: true })
    }
  }, [excalidrawAPI])

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
     * See App.css for the parent container rules.
     */
    <div className="whiteboard-container">
      {showTemplates && (
        <TemplatesModal
          templates={TEMPLATES}
          onSelect={handleLoadTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

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
            <MainMenu.Item onSelect={handleExportSvg}>
              Export as SVG
            </MainMenu.Item>
            <MainMenu.Item onSelect={() => setShowTemplates(true)}>
              Templates
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
       * The Save button is a minimum 44px tall (inclusive of 0.5rem vertical
       * padding on a 1rem line-height at 0.875rem = ~14px text). Adjusted to
       * meet the 44px touch-target minimum: padding increased from 0.2rem to
       * 0.5rem vertical, font stays 0.875rem.
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
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid var(--cloistr-border)',
            borderRadius: '0.25rem',
            backgroundColor: persistenceState.dirty ? 'var(--cloistr-info)' : 'var(--cloistr-success)',
            color: 'white',
            cursor: persistenceState.dirty ? 'pointer' : 'default',
            opacity: (!persistenceState.initialized || persistenceState.saving || !persistenceState.dirty) ? 0.5 : 1,
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
