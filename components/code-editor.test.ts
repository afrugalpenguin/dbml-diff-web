import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { errorLineEffect, errorLineField } from './code-editor'

function errorLines(state: EditorState) {
  const lines: number[] = []
  state.field(errorLineField).between(0, state.doc.length, (from, _to, decoration) => {
    if (decoration.spec.class === 'cm-error-line') lines.push(state.doc.lineAt(from).number)
  })
  return lines
}

describe('editor error line', () => {
  it('decorates the error line and removes it when cleared', () => {
    let state = EditorState.create({ doc: 'Table a {\n  id int\n}', extensions: [errorLineField] })
    expect(errorLines(state)).toEqual([])
    state = state.update({ effects: errorLineEffect.of(2) }).state
    expect(errorLines(state)).toEqual([2])
    state = state.update({ effects: errorLineEffect.of(3) }).state
    expect(errorLines(state)).toEqual([3])
    state = state.update({ effects: errorLineEffect.of(null) }).state
    expect(errorLines(state)).toEqual([])
  })
})
