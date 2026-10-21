import type { AttentionItem } from '../../lib/summary-changes'

export function SummaryAttention({
  items,
  open,
  onToggle,
  onSelect,
}: {
  items: AttentionItem[]
  open: boolean
  onToggle: () => void
  onSelect: (item: AttentionItem) => void
}) {
  if (items.length === 0) return null
  return (
    <section id="summary-attention" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold text-amber-500"
      >
        <span aria-hidden="true">{open ? '⌄' : '›'}</span>Needs attention{' '}
        <span className="font-mono text-xs">{items.length}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 text-sm">
          {items.map((item) => (
            <button
              key={`${item.id}-${item.text}`}
              onClick={() => onSelect(item)}
              className="text-left font-mono hover:underline"
            >
              {item.text}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
