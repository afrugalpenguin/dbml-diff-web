'use client'

import { useEffect, useRef } from 'react'
import { EditorView, keymap, Decoration } from '@codemirror/view'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { lineNumbers } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

type CodeEditorProps = {
  label: string
  value: string
  onChange: (value: string) => void
  errorLine?: number
  focusText?: string
}

const dbmlLanguage = StreamLanguage.define({
  startState: () => ({ context: '', inString: false }),
  token(stream, state: { context: string; inString: boolean }) {
    if (stream.sol()) state.context = ''
    if (stream.eatSpace()) return null
    if (stream.match('//')) { stream.skipToEnd(); return 'comment' }
    if (stream.peek() === '"' || stream.peek() === "'") {
      const quote = stream.next()
      while (!stream.eol()) {
        if (stream.next() === quote) break
      }
      return 'string'
    }
    if (stream.match(/^\[(?:[^\]]+)\]/)) return 'bracket'
    if (stream.match(/^(?:TABLE|Table|REF|Ref|ENUM|Enum|TABLEGROUP|TableGroup|INDEXES|Indexes|NOTE|Note)\b/)) return 'keyword'
    if (stream.match(/^(?:int|integer|bigint|smallint|tinyint|decimal|numeric|float|real|double|boolean|bool|date|datetime|timestamp|time|uuid|varchar|nvarchar|char|text|json|jsonb|blob|binary)\b/i)) return 'type'
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number'
    if (stream.match(/^[A-Za-z_][\w$.-]*/)) return state.context ? 'variable' : 'variable-2'
    stream.next()
    return null
  },
})

const dbmlHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: '#c084fc', fontWeight: '700' },
  { tag: tags.typeName, color: '#67e8f9' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.comment, color: '#64748b' },
  { tag: tags.bracket, color: '#fbbf24' },
  { tag: tags.number, color: '#fdba74' },
  { tag: tags.variableName, color: '#e2e8f0' },
])

export const errorLineEffect = StateEffect.define<number | null>()
const focusLineEffect = StateEffect.define<number | null>()
export const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    decorations = decorations.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(errorLineEffect)) {
        if (!effect.value) return Decoration.none
        const line = transaction.state.doc.line(Math.min(effect.value, transaction.state.doc.lines))
        return Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)])
      }
      if (effect.is(focusLineEffect)) {
        if (!effect.value) return Decoration.none
        const line = transaction.state.doc.line(Math.min(effect.value, transaction.state.doc.lines))
        return Decoration.set([Decoration.line({ class: 'cm-focus-line' }).range(line.from)])
      }
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

type DecorationSet = ReturnType<typeof Decoration.set>

export function CodeEditor({ label, value, onChange, errorLine, focusText }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        lineNumbers(),
        bracketMatching(),
        dbmlLanguage,
        syntaxHighlighting(dbmlHighlighting),
        oneDark,
        errorLineField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: 'transparent' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.875rem', lineHeight: '1.5rem' },
          '.cm-content': { padding: '1.25rem 1.25rem 1.25rem 0' },
          '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#64748b', paddingLeft: '0.75rem' },
          '.cm-activeLine': { backgroundColor: 'rgba(148, 163, 184, 0.06)' },
          '.cm-error-line': { backgroundColor: 'rgba(248, 113, 113, 0.16)', color: '#fca5a5' },
          '.cm-focus-line': { backgroundColor: 'rgba(251, 191, 36, 0.2)', boxShadow: 'inset 3px 0 0 #fbbf24', animation: 'cm-focus-flash 0.55s ease-in-out 3' },
        }),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || value === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: errorLineEffect.of(errorLine ?? null) })
  }, [errorLine])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const lineNumber = focusText ? Array.from({ length: view.state.doc.lines }, (_, index) => index + 1).find((number) => view.state.doc.line(number).text.includes(focusText)) : undefined
    view.dispatch({ effects: focusLineEffect.of(null) })
    if (lineNumber) {
      const line = view.state.doc.line(lineNumber)
      view.dispatch({ effects: [focusLineEffect.of(lineNumber), EditorView.scrollIntoView(line.from, { y: 'center' })] })
    }
  }, [focusText])

  return <><style>{'@keyframes cm-focus-flash { 0%, 100% { background-color: rgba(251, 191, 36, 0.2); } 50% { background-color: rgba(251, 191, 36, 0.58); } }'}</style><div className="flex h-[570px] flex-1 flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring">
    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-sm font-semibold"><span>{label}</span><span className="font-mono text-xs text-muted-foreground">DBML</span></div>
    <div ref={hostRef} aria-label={`${label} DBML`} className="h-[520px] overflow-hidden" />
  </div></> 
}
