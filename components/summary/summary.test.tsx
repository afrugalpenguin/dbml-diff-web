// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { compareSchemas } from '../../lib/compare'
import { Summary } from './summary'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // jsdom implements neither, and the Summary's jump uses both.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = vi.fn()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Summary attention items', () => {
  it('report the clicked item to the page so it can focus the editor', () => {
    const parsed = compareSchemas('Table t {\n  id int\n  a int\n}', 'Table t {\n  id int\n}').parsedResult
    const onAttention = vi.fn()
    act(() => root.render(createElement(Summary, { parsed, counts: parsed.counts, onAttention })))
    const item = [...container.querySelectorAll('#summary-attention button')].find((button) =>
      button.textContent?.startsWith('t.a removed in B'),
    )
    expect(item).toBeDefined()
    act(() => (item as HTMLButtonElement).click())
    expect(onAttention).toHaveBeenCalledWith({ schema: 'old', table: 't', column: 'a' })
  })
})
