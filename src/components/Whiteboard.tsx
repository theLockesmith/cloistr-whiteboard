import React, { useState, useEffect, useCallback } from 'react'
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw'
import type {
  AppState,
  ExcalidrawImperativeAPI
} from '@excalidraw/excalidraw/types/types'
import { useAuth } from '../auth/AuthContext'

const Whiteboard: React.FC = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const { pubkey, isAuthenticated } = useAuth()

  // TODO: Add y-excalidraw integration when available
  // For now, this is a basic Excalidraw instance without real-time collaboration

  const handleChange = useCallback((elements: readonly any[], _appState: AppState) => {
    // TODO: Sync changes via Yjs/Nostr when y-excalidraw is integrated
    console.log('Whiteboard changed:', { elements: elements.length, user: pubkey })
  }, [pubkey])

  useEffect(() => {
    if (excalidrawAPI && isAuthenticated) {
      // TODO: Initialize collaboration session
      console.log('User authenticated:', pubkey)
    }
  }, [excalidrawAPI, isAuthenticated, pubkey])

  return (
    <div className="whiteboard-container">
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
          {!isAuthenticated && (
            <MainMenu.Item onSelect={() => console.log('Auth needed')}>
              Sign in to collaborate
            </MainMenu.Item>
          )}
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
  )
}

export default Whiteboard