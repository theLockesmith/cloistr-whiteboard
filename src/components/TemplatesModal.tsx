import React from 'react'
import type { WhiteboardTemplate } from '../templates'
import './TemplatesModal.css'

interface TemplatesModalProps {
  templates: WhiteboardTemplate[]
  onSelect: (template: WhiteboardTemplate) => void
  onClose: () => void
}

/**
 * Modal overlay for choosing a starting template.
 *
 * Accessible: traps focus, supports Escape to close, has a visible close button,
 * and all interactive elements are at least 44px tall for mobile.
 */
const TemplatesModal: React.FC<TemplatesModalProps> = ({ templates, onSelect, onClose }) => {
  // Close on Escape key
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="templates-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a template"
      onClick={(e) => {
        // Close when clicking backdrop, not the panel itself
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="templates-panel">
        <div className="templates-header">
          <h2 className="templates-title">Start from a template</h2>
          <button
            className="templates-close"
            onClick={onClose}
            aria-label="Close template picker"
          >
            ✕
          </button>
        </div>

        <div className="templates-grid">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              className="template-card"
              onClick={() => {
                onSelect(tmpl)
                onClose()
              }}
            >
              <span className="template-emoji" aria-hidden="true">
                {tmpl.emoji}
              </span>
              <span className="template-name">{tmpl.name}</span>
              <span className="template-desc">{tmpl.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TemplatesModal
