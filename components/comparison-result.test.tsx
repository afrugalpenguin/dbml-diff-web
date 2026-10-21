import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compareSchemas } from '../lib/compare'
import { ComparisonResult, type ResultTab } from './comparison-result'

const output = compareSchemas('Table users {\n  id int\n}', 'Table users {\n  id bigint\n}')
const comparison = { id: 'Abcdef1234', oldDbml: '', newDbml: '', createdAt: '2026-01-01T00:00:00.000Z', ...output }

function render(tab: ResultTab) {
  return renderToStaticMarkup(createElement(ComparisonResult, { comparison, tab, onTab: () => {}, onAttention: () => {} }))
}

describe('ComparisonResult', () => {
  it('shows the Summary on the Summary tab', () => {
    expect(render('Summary')).toContain('aria-label="Diff notation legend"')
  })

  it.each([
    ['Text', output.text],
    ['Migration', output.migration],
    ['DBML', output.dbml],
  ] as const)('shows the %s output on its tab', (tab, text) => {
    const markup = render(tab)
    expect(markup).not.toContain('aria-label="Diff notation legend"')
    expect(markup).toContain(renderToStaticMarkup(createElement('pre', null, text)).slice(5, -6))
  })

  it('offers the Diagram tab only when the comparison has a graph', () => {
    const tabs = (markup: string) => [...markup.matchAll(/<button[^>]*>(Summary|Diagram|Text|Migration|DBML)<\/button>/g)].map((match) => match[1])
    expect(tabs(render('Summary'))).toEqual(['Summary', 'Text', 'Migration', 'DBML'])
    const graph = { tables: [], refs: [], unresolved: 0 }
    const withGraph = renderToStaticMarkup(
      createElement(ComparisonResult, { comparison: { ...comparison, graph }, tab: 'Summary', onTab: () => {}, onAttention: () => {} }),
    )
    expect(tabs(withGraph)).toEqual(['Summary', 'Diagram', 'Text', 'Migration', 'DBML'])
  })

  it('heads the Migration tab with the SQL title', () => {
    expect(render('Migration')).toContain('SQL to turn A into B')
    expect(render('Text')).not.toContain('SQL to turn A into B')
  })
})
