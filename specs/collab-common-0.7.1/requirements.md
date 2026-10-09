# collab-common 0.7.1 load gate in whiteboard — requirements

Before collab-common 0.7.1 a relay that connected but never answered the
snapshot query looked like "no board": the canvas came up blank and the next
save replaced the real board. 0.7.1 reports that as `loadStatus: 'failed'`
and refuses saves until loaded.

- R1 No save path (status button, Ctrl+S) attempts a save unless
  `loadStatus === 'loaded'`; when blocked it says why.
- R2 The canvas mounts only after a confirmed load, so the Yjs binding is
  created over loaded content; a failed load shows an error with Retry.
- R3 Live: an edit after sign-in never replaces an existing board; a relay that
  connects but never answers shows the error.
