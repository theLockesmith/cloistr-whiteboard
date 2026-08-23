/**
 * Tests for the whiteboard templates module.
 *
 * These are SOURCE-LEVEL STRUCTURAL tests: they verify the shape and validity
 * of the template data without mounting React or running Excalidraw. They do
 * NOT test rendering behaviour -- for that, a full integration test against a
 * running Excalidraw instance would be needed.
 *
 * Rationale: the template elements are applied via excalidrawAPI.updateScene()
 * at runtime. A malformed element (missing required field, wrong type) would
 * silently produce an empty or broken canvas. These tests catch that class of
 * defect at build time.
 */
import { describe, it, expect } from 'vitest'
import { TEMPLATES } from '../templates'
import type { WhiteboardTemplate } from '../templates'

describe('TEMPLATES', () => {
  it('exports an array with at least one entry', () => {
    expect(Array.isArray(TEMPLATES)).toBe(true)
    expect(TEMPLATES.length).toBeGreaterThan(0)
  })

  it('includes a blank template with no elements', () => {
    const blank = TEMPLATES.find((t) => t.id === 'blank')
    expect(blank).toBeDefined()
    expect(blank!.elements).toHaveLength(0)
  })

  it('includes brainstorm, flowchart, and retro templates', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(ids).toContain('brainstorm')
    expect(ids).toContain('flowchart')
    expect(ids).toContain('retro')
  })

  it('every template has required metadata fields', () => {
    for (const tmpl of TEMPLATES) {
      expect(typeof tmpl.id).toBe('string')
      expect(tmpl.id.length).toBeGreaterThan(0)
      expect(typeof tmpl.name).toBe('string')
      expect(tmpl.name.length).toBeGreaterThan(0)
      expect(typeof tmpl.description).toBe('string')
      expect(typeof tmpl.emoji).toBe('string')
      expect(Array.isArray(tmpl.elements)).toBe(true)
    }
  })

  it('every non-blank template has at least one element', () => {
    const nonBlank = TEMPLATES.filter((t) => t.id !== 'blank')
    for (const tmpl of nonBlank) {
      expect(tmpl.elements.length).toBeGreaterThan(0)
    }
  })

  it('every element has required Excalidraw fields', () => {
    const requiredFields = ['id', 'type', 'x', 'y', 'width', 'height', 'angle', 'strokeColor']
    for (const tmpl of TEMPLATES) {
      for (const el of tmpl.elements) {
        for (const field of requiredFields) {
          expect(el, `template "${tmpl.id}" element "${(el as any).id}" missing "${field}"`).toHaveProperty(field)
        }
      }
    }
  })

  it('element ids within a template are unique', () => {
    for (const tmpl of TEMPLATES) {
      const ids = tmpl.elements.map((el) => el.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    }
  })

  it('element ids across templates use tmpl- prefix (avoids collision with user content)', () => {
    for (const tmpl of TEMPLATES) {
      for (const el of tmpl.elements) {
        expect(el.id).toMatch(/^tmpl-/)
      }
    }
  })

  it('all template ids are unique', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('WhiteboardTemplate type shape', () => {
  it('TEMPLATES entries are assignable to WhiteboardTemplate', () => {
    // TypeScript type check - if this compiles, the types match.
    const _typed: WhiteboardTemplate[] = TEMPLATES
    expect(_typed).toBeDefined()
  })
})
