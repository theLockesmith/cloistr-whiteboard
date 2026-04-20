# CLAUDE.md - Cloistr Whiteboard

**Collaborative whiteboard application using Excalidraw with Nostr-based real-time collaboration.**

## Project Information

- **Company:** Coldforge LLC
- **Type:** Web Application
- **Purpose:** Collaborative whiteboard (Excalidraw/Miro alternative) with Nostr integration
- **Tech Stack:** React 18 + TypeScript + Vite + Excalidraw

## Architecture

### Core Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@excalidraw/excalidraw` | Core whiteboard functionality | ^0.17.3 |
| `yjs` | CRDT for real-time collaboration | ^13.6.10 |
| `nostr-tools` | Nostr protocol integration | ^2.3.1 |
| `cloistr-collab-common` | Shared collaboration utilities | file:../cloistr-collab-common |

### Project Structure

```
src/
├── main.tsx              # React entrypoint
├── App.tsx               # Main app with AuthProvider
├── components/
│   └── Whiteboard.tsx    # Excalidraw integration
├── index.css             # Global styles
└── App.css              # App-specific styles
```

## Features

### Current Implementation

- ✅ Basic Excalidraw integration
- ✅ Authentication via cloistr-collab-common
- ✅ Responsive design (fullscreen whiteboard)
- ✅ Custom UI options and menu items

### Planned Features

- 🚧 **Real-time collaboration via y-excalidraw** (pending package availability)
- 🚧 **Nostr event synchronization** for persistent whiteboard state
- 🚧 **Room-based collaboration** using Nostr event kinds
- 🚧 **Presence indicators** showing active collaborators
- 🚧 **Conflict resolution** using Yjs CRDTs

## Development

### Local Development

```bash
npm run dev    # Start development server (port 3000)
npm run build  # Build for production
npm run preview # Preview production build
```

### Build Configuration

- **Vite:** Optimized for Excalidraw bundle size
- **TypeScript:** Strict mode, ES2022 target
- **Code splitting:** Separate chunks for Excalidraw, Yjs, and Nostr

## Collaboration Architecture

### TODO: y-excalidraw Integration

When `y-excalidraw` becomes available, the integration will:

1. **Create Yjs document** for each whiteboard room
2. **Bind Excalidraw state** to Yjs shared types
3. **Sync via Nostr** using custom provider
4. **Handle presence** for real-time cursors and user awareness

### Nostr Integration Pattern

```typescript
// Planned architecture
const roomId = "whiteboard:room123"
const yjsDoc = new Y.Doc()
const excalidrawBinding = new ExcalidrawYjsBinding(excalidrawAPI, yjsDoc)
const nostrProvider = new NostrYjsProvider(yjsDoc, roomId, relayUrls, signer)
```

## UI/UX Design

### Responsive Layout

- **Fullscreen whiteboard** (100vw x 100vh)
- **Minimal chrome** - focus on drawing canvas
- **Authentication integration** in main menu
- **Dark/light theme** following system preference

### Custom Menu Items

- Sign in prompt for unauthenticated users
- Real-time collaboration status indicators
- Room sharing and invitation features

## Technical Notes

### Excalidraw Configuration

- **Disabled features:** File loading/saving (using Nostr instead)
- **Enabled features:** Image export, canvas background changes
- **Custom welcome screen** with Cloistr branding

### Performance Optimizations

- **Bundle splitting** for large dependencies
- **Optimized dependencies** in Vite config
- **Lazy loading** for collaboration features

## Deployment

### Development Workflow

1. Changes made in `/home/forgemaster/Development/cloistr-whiteboard/`
2. Built and tested locally via `npm run build`
3. Deployed via GitLab CI/CD pipeline
4. Container registry: `registry.aegis-hq.xyz/coldforge/cloistr-whiteboard`

### Environment Variables

```bash
VITE_NOSTR_RELAY_URLS=wss://relay.cloistr.xyz,wss://relay2.cloistr.xyz
VITE_SIGNER_URL=https://signer.cloistr.xyz
```

## Related Projects

- `cloistr-collab-common` - Shared collaboration utilities
- `cloistr-relay` - Nostr relay for event synchronization
- `cloistr-signer` - Authentication and signing service

---

**Last Updated:** 2026-03-20

**Status:** Initial scaffold created, ready for y-excalidraw integration