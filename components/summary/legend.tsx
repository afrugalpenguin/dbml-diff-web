export function SummaryLegend() {
  return (
    <aside
      aria-label="Diff notation legend"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground"
    >
      <span className="font-medium text-foreground">Legend</span>
      <span>
        <strong className="font-mono text-emerald-500">+</strong> added in B
      </span>
      <span>
        <strong className="font-mono text-red-500">-</strong> removed in B
      </span>
      <span>
        <strong className="font-mono text-amber-500">~</strong> modified
      </span>
      <span>
        <strong className="font-mono text-sky-500">{'\u2192'}</strong> references
      </span>
      <span>
        <strong className="font-mono text-amber-500">{'\u21aa'}</strong> moved
      </span>
    </aside>
  )
}
