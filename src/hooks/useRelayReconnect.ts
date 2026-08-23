/**
 * useRelayReconnect — Part 4 of the signer-resilience design, local shim.
 *
 * WHY THIS IS HERE
 *
 * @cloistr/ui 0.26.0 ships SignerRecovery and signerRetry (parts 1-3) but does
 * not yet export useRelayReconnect (part 4, added in 0.27.0 which is not yet
 * published). This file is a local copy of that hook so the whiteboard gets
 * the full resilience design without waiting for a registry release.
 *
 * When 0.27.0 lands on the registry:
 *   1. Bump @cloistr/ui to ^0.27.0 in package.json.
 *   2. Delete this file.
 *   3. Remove the import and call-site in App.tsx.
 *   SharedAuthProvider in ^0.27.0 wires the hook itself, so the whiteboard
 *   will then get it for free with no explicit mount.
 *
 * WHY VISIBILITYCHANGE / ONLINE
 *
 * When a phone backgrounds the page (app-switcher, file picker, screen lock)
 * the OS kills WebSocket connections. Parts 1-3 handle signing failures
 * gracefully after the fact. This hook prevents the failure from happening
 * at all by reconnecting relay sockets the moment the page becomes visible
 * again — before the user acts.
 *
 * The 'online' event handles device regaining network after going offline.
 *
 * WHY DEBOUNCE
 *
 * A file-picker or screen-lock/unlock sequence can fire visibilitychange
 * several times rapidly. Debouncing collapses those into one reconnect attempt.
 *
 * WHY NIP-46 ONLY
 *
 * NIP-07 (browser extension) signers manage their own WebSockets. Only NIP-46
 * signers use relay WebSockets that the OS can kill on backgrounding.
 *
 * SESSION STATE IS NEVER TOUCHED
 *
 * This hook never calls logout, clearAuth, clearSharedSession, or any
 * session-clearing function. A reconnect hook that clears auth reintroduces
 * the exact bug the signer-resilience design exists to fix.
 */

import { useEffect, useRef } from 'react'
import type { SignerInterface } from '@cloistr/auth'

export interface RelayReconnectOptions {
  /** How long to wait after the last event before reconnecting. Default: 300ms. */
  debounceMs?: number
}

interface AuthStateLike {
  isConnected: boolean
  method?: string | null
}

/**
 * Reconnects relay WebSocket connections when the page regains visibility or
 * the network comes back online — before the user acts.
 *
 * Must be called inside an auth context where authState and signer are available.
 */
export function useRelayReconnect(
  signer: SignerInterface | null,
  authState: AuthStateLike,
  options: RelayReconnectOptions = {},
): void {
  const { debounceMs = 300 } = options

  // Keep current values in refs so handlers always read the latest without
  // being removed and re-added on every auth state change.
  const authStateRef = useRef(authState)
  const signerRef = useRef(signer)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    authStateRef.current = authState
  }, [authState])

  useEffect(() => {
    signerRef.current = signer
  }, [signer])

  useEffect(() => {
    const scheduleReconnect = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const state = authStateRef.current
        const currentSigner = signerRef.current

        // Only act for NIP-46 sessions with a live signer. NIP-07 extensions
        // manage their own sockets. Sessions never established have nothing to
        // warm up.
        if (!state.isConnected || state.method !== 'nip46' || currentSigner === null) {
          return
        }

        // getPublicKey() exercises the Nip46Signer's lazy-connect path.
        // Result is discarded; failure is silently swallowed here because
        // SignerRecovery (part 3) handles it when the user actually acts.
        currentSigner.getPublicKey().catch(() => {
          // Reconnect attempt failed. SignerRecovery will handle the next
          // failed user action.
        })
      }, debounceMs)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleReconnect()
      }
    }

    const onOnline = () => {
      scheduleReconnect()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [debounceMs])
}
