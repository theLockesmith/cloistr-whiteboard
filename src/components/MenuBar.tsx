/**
 * MenuBar — Cloistr-level persistent menu bar for Whiteboard.
 *
 * Covers only what Excalidraw's own MainMenu does NOT: board management,
 * export to Cloistr formats, templates, and sharing. Excalidraw keeps its
 * hamburger menu for canvas-native controls (clear canvas, background).
 *
 * Keyboard contract:
 *  - Tab reaches the bar; ArrowLeft/Right move between triggers.
 *  - Enter/Space/ArrowDown on a trigger opens its menu and focuses first item.
 *  - ArrowDown/Up navigate items; Home/End jump to ends.
 *  - ArrowRight/Left on an open item pivot to the adjacent menu.
 *  - Escape closes the open menu and returns focus to the trigger.
 *  - Tab while a menu is open closes it without moving to next trigger (natural flow).
 *
 * Mobile: at < 600 px the entire bar hides and a single "Menu" toggle
 * replaces it, opening a full-panel drawer with all sections visible.
 * A horizontal row of 4+ menu buttons at 390 px overflows and teaches
 * users the app is broken; a drawer is usable on any width.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import './MenuBar.css'

// --- Public types -----------------------------------------------------------

export interface MenuBarAction {
  id: string
  label: string
  shortcut?: string        // display text, e.g. "Ctrl+S"
  disabled?: boolean
  disabledReason?: string  // shown as tooltip when disabled
  action: () => void
}

export interface MenuBarDivider {
  id: string
  divider: true
}

export type MenuBarItem = MenuBarAction | MenuBarDivider

export interface MenuBarSection {
  id: string
  label: string
  items: MenuBarItem[]
}

interface MenuBarProps {
  sections: MenuBarSection[]
}

// --- Helpers ----------------------------------------------------------------

function isDivider(item: MenuBarItem): item is MenuBarDivider {
  return 'divider' in item && (item as MenuBarDivider).divider === true
}

/** All action items (non-dividers) from a section, in order. */
function actionItems(section: MenuBarSection): MenuBarAction[] {
  return section.items.filter((i): i is MenuBarAction => !isDivider(i))
}

// --- Component --------------------------------------------------------------

const MenuBar: React.FC<MenuBarProps> = ({ sections }) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const barRef = useRef<HTMLDivElement>(null)
  // One ref slot per section trigger.
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Map from sectionId → ordered array of action-button refs (no dividers).
  const itemRefMap = useRef<Map<string, (HTMLButtonElement | null)[]>>(new Map())

  // Ensure ref arrays exist for every section.
  sections.forEach(s => {
    if (!itemRefMap.current.has(s.id)) {
      itemRefMap.current.set(s.id, [])
    }
  })

  // --- Close on outside click ----------------------------------------------
  useEffect(() => {
    if (!openMenu && !mobileOpen) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu, mobileOpen])

  // --- Escape closes --------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (openMenu) {
        const idx = sections.findIndex(s => s.id === openMenu)
        setOpenMenu(null)
        triggerRefs.current[idx]?.focus()
      } else if (mobileOpen) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openMenu, mobileOpen, sections])

  // --- Open a section and focus its first/last item -------------------------
  const openSection = useCallback((sectionId: string, focusLast = false) => {
    setOpenMenu(sectionId)
    // Wait one tick for the dropdown to render.
    setTimeout(() => {
      const refs = itemRefMap.current.get(sectionId) ?? []
      const enabled = refs.filter(r => r && !r.disabled)
      if (focusLast) {
        enabled[enabled.length - 1]?.focus()
      } else {
        enabled[0]?.focus()
      }
    }, 0)
  }, [])

  // --- Trigger keydown ------------------------------------------------------
  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, sectionId: string, idx: number) => {
      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault()
          const next = (idx + 1) % sections.length
          triggerRefs.current[next]?.focus()
          if (openMenu) openSection(sections[next].id)
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const prev = (idx - 1 + sections.length) % sections.length
          triggerRefs.current[prev]?.focus()
          if (openMenu) openSection(sections[prev].id)
          break
        }
        case 'ArrowDown':
        case 'Enter':
        case ' ': {
          e.preventDefault()
          openSection(sectionId)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          openSection(sectionId, /* focusLast */ true)
          break
        }
      }
    },
    [openMenu, openSection, sections],
  )

  // --- Item keydown ---------------------------------------------------------
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, sectionId: string, _ownIdx: number) => {
      const refs = itemRefMap.current.get(sectionId) ?? []
      const enabled = refs.filter((r): r is HTMLButtonElement => !!r && !r.disabled)
      const cur = enabled.indexOf(e.currentTarget)

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          enabled[(cur + 1) % enabled.length]?.focus()
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          enabled[(cur - 1 + enabled.length) % enabled.length]?.focus()
          break
        }
        case 'Home': {
          e.preventDefault()
          enabled[0]?.focus()
          break
        }
        case 'End': {
          e.preventDefault()
          enabled[enabled.length - 1]?.focus()
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          const secIdx = sections.findIndex(s => s.id === sectionId)
          const next = (secIdx + 1) % sections.length
          openSection(sections[next].id)
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const secIdx2 = sections.findIndex(s => s.id === sectionId)
          const prev = (secIdx2 - 1 + sections.length) % sections.length
          openSection(sections[prev].id, true)
          break
        }
        case 'Tab': {
          // Natural tab flow: just close without stealing focus.
          setOpenMenu(null)
          break
        }
      }
    },
    [openSection, sections],
  )

  // --- Activate an item -----------------------------------------------------
  const activateItem = useCallback((item: MenuBarAction) => {
    if (item.disabled) return
    setOpenMenu(null)
    setMobileOpen(false)
    item.action()
  }, [])

  // --- Render a dropdown menu -----------------------------------------------
  const renderDropdown = (section: MenuBarSection) => {
    // Reset ref array length to match current action-item count.
    const actions = actionItems(section)
    const refs = itemRefMap.current.get(section.id)!
    refs.length = actions.length

    let actionIdx = -1

    return (
      <div
        role="menu"
        aria-label={section.label}
        className="menubar-dropdown"
      >
        {section.items.map(item => {
          if (isDivider(item)) {
            return (
              <div
                key={item.id}
                role="separator"
                className="menubar-separator"
              />
            )
          }
          actionIdx++
          const thisIdx = actionIdx
          return (
            <button
              key={item.id}
              ref={el => { refs[thisIdx] = el }}
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled && item.disabledReason ? item.disabledReason : undefined}
              className="menubar-item"
              onClick={() => activateItem(item)}
              onKeyDown={e => handleItemKeyDown(e, section.id, thisIdx)}
            >
              <span className="menubar-item-label">{item.label}</span>
              {item.shortcut && (
                <kbd className="menubar-shortcut">{item.shortcut}</kbd>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // --- Render mobile panel --------------------------------------------------
  const renderMobilePanel = () => (
    <div
      className="menubar-mobile-panel"
      role="dialog"
      aria-label="App menu"
      aria-modal="true"
    >
      {sections.map(section => (
        <div key={section.id} className="menubar-mobile-section">
          <div
            className="menubar-mobile-section-heading"
            role="presentation"
          >
            {section.label}
          </div>
          {section.items.map(item => {
            if (isDivider(item)) {
              return (
                <div
                  key={item.id}
                  role="separator"
                  className="menubar-separator"
                />
              )
            }
            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                title={item.disabled && item.disabledReason ? item.disabledReason : undefined}
                className="menubar-mobile-item"
                onClick={() => activateItem(item)}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <kbd className="menubar-shortcut">{item.shortcut}</kbd>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )

  // --- Main render ----------------------------------------------------------
  return (
    <div ref={barRef} className="menubar-root">
      {/* Desktop: persistent horizontal bar */}
      <nav
        className="menubar-bar"
        aria-label="Whiteboard menu bar"
      >
        <div
          role="menubar"
          className="menubar-triggers"
          aria-label="Whiteboard menu bar"
        >
          {sections.map((section, idx) => (
            <div key={section.id} className="menubar-menu-root">
              <button
                ref={el => { triggerRefs.current[idx] = el }}
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={openMenu === section.id}
                className={`menubar-trigger${openMenu === section.id ? ' is-open' : ''}`}
                onClick={() =>
                  setOpenMenu(openMenu === section.id ? null : section.id)
                }
                onKeyDown={e => handleTriggerKeyDown(e, section.id, idx)}
              >
                {section.label}
              </button>
              {openMenu === section.id && renderDropdown(section)}
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile: single toggle + panel */}
      <div className="menubar-mobile-wrap">
        <button
          className={`menubar-mobile-trigger${mobileOpen ? ' is-open' : ''}`}
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          aria-label={mobileOpen ? 'Close app menu' : 'Open app menu'}
          onClick={() => setMobileOpen(m => !m)}
        >
          <span aria-hidden="true" className="menubar-mobile-icon">
            {mobileOpen ? '✕' : '≡'}
          </span>
          Menu
        </button>
        {mobileOpen && renderMobilePanel()}
      </div>
    </div>
  )
}

export default MenuBar
export type { MenuBarProps }
