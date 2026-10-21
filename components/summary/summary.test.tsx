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

describe('Summary jumps from the diagram', () => {
  // Enough changed tables that rows start collapsed.
  const tables = Array.from({ length: 12 }, (_, index) => `t${index}`)
  const parsed = compareSchemas(
    tables.map((name) => `Table ${name} {\n  id int\n}`).join('\n'),
    tables.map((name) => `Table ${name} {\n  id bigint\n}`).join('\n'),
  ).parsedResult
  const render = (jumpTo?: { table: string; key: number }) =>
    act(() => root.render(createElement(Summary, { parsed, counts: parsed.counts, jumpTo })))
  const button = (text: string) => [...container.querySelectorAll('button')].find((entry) => entry.textContent === text)!

  it('shows, expands, flashes and scrolls to the table even when filters hide it', () => {
    render()
    act(() => button('Enums').click())
    act(() => button('Removed').click())
    expect(container.querySelector('[id="table-t7"]')).toBeNull()
    render({ table: 't7', key: 1 })
    const row = container.querySelector('[id="table-t7"]')
    expect(row).not.toBeNull()
    expect(row?.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
    expect(row?.querySelector('button')?.className).toContain('summary-flash-row')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('opens the Tables section when it is collapsed', () => {
    render()
    act(() => (container.querySelector('#summary-tables button') as HTMLButtonElement).click())
    expect(container.querySelector('[id="table-t3"]')).toBeNull()
    render({ table: 't3', key: 1 })
    expect(container.querySelector('[id="table-t3"]')).not.toBeNull()
  })
})
