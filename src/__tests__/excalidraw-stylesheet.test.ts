import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Why this exists.
 *
 * @excalidraw/excalidraw 0.18 stopped injecting its own styles; the app must
 * import '@excalidraw/excalidraw/index.css'. The 0.18 bump arrived via Renovate
 * on 2026-09-02 without that import, and production whiteboard rendered as
 * unstyled controls with no usable canvas (a scripted rectangle drag created
 * nothing) for about five weeks, while every check stayed green.
 *
 * Two assertions, because either alone lets it happen again:
 *   1. the entry point imports the stylesheet;
 *   2. that import resolves to the package's real stylesheet, so a future
 *      version that moves or renames it fails here instead of in production.
 */

const here = dirname(fileURLToPath(import.meta.url))
const STYLESHEET = '@excalidraw/excalidraw/index.css'

describe('Excalidraw stylesheet', () => {
  it('is imported by the app entry point', () => {
    const main = readFileSync(join(here, '..', 'main.tsx'), 'utf8')
    const imports = main.split('\n').filter((l) => /^\s*import\s/.test(l))
    expect(imports.some((l) => l.includes(`'${STYLESHEET}'`) || l.includes(`"${STYLESHEET}"`))).toBe(true)
  })

  it('resolves to the real Excalidraw stylesheet', () => {
    const require = createRequire(import.meta.url)
    const css = readFileSync(require.resolve(STYLESHEET), 'utf8')
    // The rules that lay out the canvas and toolbar live under .excalidraw.
    expect(css.length).toBeGreaterThan(10_000)
    expect(css).toContain('.excalidraw')
  })
})
