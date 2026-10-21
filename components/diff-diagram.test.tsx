// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { compareSchemas } from '../lib/compare'
import { schemaGraph } from '../lib/schema-graph'
import type { SchemaGraph } from '../lib/diff-types'
import { DiffDiagram } from './diff-diagram'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

// React Flow measures its container and nodes; jsdom has no layout, so give everything a size.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, contentRect: { width: 1000, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.DOMMatrixReadOnly = class {
    m22 = 1
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([1-9.])\)/)?.[1]
      this.m22 = scale ? Number(scale) : 1
    }
  } as unknown as typeof DOMMatrixReadOnly
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { get: () => 1000 },
    offsetHeight: { get: () => 600 },
  })
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) as never
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const oldDbml = 'Table a {\n  id int\n}\nTable b {\n  id int\n  a_id int\n}\nTable c {\n  id int\n}\nRef: b.a_id > a.id'
const newDbml = oldDbml.replace('Table a {\n  id int\n}', 'Table a {\n  id bigint\n}')
const graph = schemaGraph(oldDbml, newDbml, compareSchemas(oldDbml, newDbml).parsedResult)

function render(diagramGraph: SchemaGraph, onSelectTable = vi.fn()) {
  act(() => root.render(createElement(DiffDiagram, { graph: diagramGraph, onSelectTable })))
  return onSelectTable
}
const node = (name: string) => container.querySelector(`.react-flow__node[data-id="${name}"]`) as HTMLElement | null
const button = (text: string) => [...container.querySelectorAll('button')].find((entry) => entry.textContent?.startsWith(text))!

describe('DiffDiagram', () => {
  it('shows changed tables and their neighbours, and the whole schema on request', () => {
    render(graph)
    expect(node('a')).not.toBeNull()
    expect(node('b')).not.toBeNull()
    expect(node('c')).toBeNull()
    act(() => button('Whole schema').click())
    expect(node('c')).not.toBeNull()
  })

  it('jumps to the Summary for a changed table', () => {
    const onSelectTable = render(graph)
    act(() => node('a')!.click())
    expect(onSelectTable).toHaveBeenCalledWith('a')
  })

  it('says an unchanged table has no changes instead of jumping', () => {
    const onSelectTable = render(graph)
    act(() => node('b')!.click())
    expect(onSelectTable).not.toHaveBeenCalled()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('No changes in b.')
  })

  it('asks before showing a whole schema of more than 300 tables', () => {
    const tables = Array.from({ length: 301 }, (_, index) => ({ name: `t${index}`, kind: 'unchanged' as const, columns: [] }))
    tables[0] = { ...tables[0], kind: 'modified' as never }
    render({ tables, refs: [], unresolved: 0 })
    act(() => button('Whole schema').click())
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('Show all 301 tables?')
    expect(node('t1')).toBeNull()
    act(() => button('Show all').click())
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(button('Whole schema').getAttribute('aria-pressed')).toBe('true')
  })
})
