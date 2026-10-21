// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CodeEditor } from './code-editor'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

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

const value = 'Table t {\n  id int\n  a int\n}'
const render = (focusLine?: { line: number; key: number }) =>
  act(() => root.render(createElement(CodeEditor, { label: 'Schema A', value, onChange: () => {}, focusLine })))
const focusedLines = () => [...container.querySelectorAll('.cm-focus-line')].map((line) => line.textContent)

describe('editor focus line', () => {
  it('highlights the given line and clears it when the focus is removed', () => {
    render({ line: 3, key: 1 })
    expect(focusedLines()).toEqual(['  a int'])
    render(undefined)
    expect(focusedLines()).toEqual([])
  })

  it('ignores a line past the end of the document', () => {
    render({ line: 9, key: 1 })
    expect(focusedLines()).toEqual([])
  })
})
