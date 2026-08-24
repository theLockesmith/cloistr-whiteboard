/**
 * Source-level test: verify that 100dvh is used everywhere 100vh was.
 *
 * This is a SOURCE-LEVEL test (reads raw file content) rather than a
 * behavioural test. It catches accidental re-introduction of 100vh in
 * viewport-height contexts without requiring a browser or CSS evaluation.
 *
 * It will fail if someone reverts the 100dvh change -- which is the correct
 * failure mode described in the task.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const srcDir = join(__dirname, '..')

function readSrc(relative: string) {
  return readFileSync(join(srcDir, relative), 'utf-8')
}

describe('100dvh mobile URL-bar fix', () => {
  it('App.css uses 100dvh not 100vh for .App height', () => {
    const css = readSrc('App.css')
    // Must contain dvh
    expect(css).toContain('100dvh')
    // Must not contain bare 100vh (not in a comment)
    const lines = css.split('\n').filter((l) => !l.trim().startsWith('/*') && !l.trim().startsWith('*'))
    const hasVhInCode = lines.some((l) => l.includes('100vh'))
    expect(hasVhInCode).toBe(false)
  })

  it('index.css uses 100dvh not 100vh for body and #root', () => {
    const css = readSrc('index.css')
    expect(css).toContain('100dvh')
    const lines = css.split('\n').filter((l) => !l.trim().startsWith('/*') && !l.trim().startsWith('*'))
    const hasVhInCode = lines.some((l) => l.includes('100vh'))
    expect(hasVhInCode).toBe(false)
  })

  it('App.tsx inline height uses 100dvh not 100vh', () => {
    const tsx = readSrc('App.tsx')
    // The LoginPrompt height should reference dvh
    expect(tsx).toContain('100dvh')
    // The only 100vh allowed in App.tsx is in comments
    const lines = tsx.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    const hasVhInCode = lines.some((l) => l.includes('100vh') && !l.includes('//'))
    expect(hasVhInCode).toBe(false)
  })
})
