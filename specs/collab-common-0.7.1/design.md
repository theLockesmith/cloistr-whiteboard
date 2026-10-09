# collab-common 0.7.1 load gate in whiteboard — design

`src/lib/persistenceGate.ts` (same contract as docs/slides/sheets). In
`Whiteboard.tsx` `handleSave` checks the gate via a ref; the capture-phase
Ctrl+S handler delegates to it; the save button uses `canSave` and reads
Loading… / Not loaded; until ready, a loading or failed panel replaces
`<Excalidraw>`, so `ExcalidrawBinding` is only ever created over a loaded doc
(its creation already applies existing yElements). `window.excalidrawAPI` is
exposed while the canvas is mounted, like sheets' `window.univerAPI`, so an
end-to-end check can count elements on a canvas.
