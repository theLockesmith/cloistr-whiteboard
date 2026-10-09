import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
// Excalidraw 0.18 no longer injects its own styles; the app must import them.
// Without this (missing since the 0.18 bump on 2026-09-02) the board renders
// as unstyled controls with no usable canvas. Before ./index.css so the app's
// own rules still win. Guarded by src/__tests__/excalidraw-stylesheet.test.ts.
import '@excalidraw/excalidraw/index.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)