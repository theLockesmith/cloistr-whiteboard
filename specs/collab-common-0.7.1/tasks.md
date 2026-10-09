# collab-common 0.7.1 load gate in whiteboard — tasks

- [x] Gate tests first, red, then `persistenceGate.ts` (verified 9/9 after red)
- [x] Save paths, button, canvas only after load, failed panel (verified Whiteboard.tsx diff)
- [x] collab-common ^0.7.1, one copy each of collab-common, ui, auth, yjs, lib0 (verified lockfile)
- [x] Full suite and typecheck (verified 58/58 after rebase onto the stylesheet fix, tsc clean)
- [x] Live on the local build with a throwaway account: A-E (verified all PASS once !83 made drawing work; silent relay shows 'could not be opened', Save 'Not loaded', Ctrl+S uploads nothing)
- [x] Runtime-config browser check unchanged (verified two-container check PASS)
