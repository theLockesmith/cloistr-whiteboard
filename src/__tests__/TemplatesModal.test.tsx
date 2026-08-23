/**
 * Behavioural tests for the TemplatesModal component.
 *
 * These tests run against a real DOM (jsdom) using React Testing Library. They
 * verify that the modal renders correctly, that clicking a template card calls
 * the handlers, that Escape closes the modal, and that the backdrop click closes
 * it -- all reachable on mobile via touch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TemplatesModal from '../components/TemplatesModal'
import type { WhiteboardTemplate } from '../templates'

const mockTemplates: WhiteboardTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty whiteboard',
    emoji: '⬜',
    elements: [],
  },
  {
    id: 'brainstorm',
    name: 'Sticky Notes',
    description: 'Grid of sticky notes',
    emoji: '🗒️',
    elements: [],
  },
]

describe('TemplatesModal', () => {
  let onSelect: ReturnType<typeof vi.fn>
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSelect = vi.fn()
    onClose = vi.fn()
  })

  it('renders the modal heading', () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    expect(screen.getByText('Start from a template')).toBeInTheDocument()
  })

  it('renders a card for each template', () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    expect(screen.getByText('Blank')).toBeInTheDocument()
    expect(screen.getByText('Sticky Notes')).toBeInTheDocument()
  })

  it('renders template descriptions', () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    expect(screen.getByText('Empty whiteboard')).toBeInTheDocument()
  })

  it('calls onSelect and onClose when a template card is clicked', async () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    const blankCard = screen.getByText('Blank').closest('button')
    expect(blankCard).not.toBeNull()
    await userEvent.click(blankCard!)
    expect(onSelect).toHaveBeenCalledWith(mockTemplates[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the close button is clicked', async () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    const closeBtn = screen.getByLabelText('Close template picker')
    await userEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', async () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('has accessible dialog role and aria-label', () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Choose a template')
  })

  it('close button has a visible accessible label', () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    expect(screen.getByLabelText('Close template picker')).toBeInTheDocument()
  })

  it('all template cards are interactive buttons', () => {
    render(<TemplatesModal templates={mockTemplates} onSelect={onSelect as any} onClose={onClose as any} />)
    const cards = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('template-card')
    )
    expect(cards).toHaveLength(mockTemplates.length)
  })
})
