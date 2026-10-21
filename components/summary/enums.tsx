import type { EnumEntry, ModifiedEnum } from '../../lib/diff-types'
import { changeClass, changeSymbol, type ChangeKind } from '../../lib/summary-changes'
import { formatEnum } from '../../lib/summary-groups'

function enumLines(kind: ChangeKind, item: EnumEntry | ModifiedEnum): Array<{ kind: ChangeKind; text: string }> {
  if ('values' in item) return [{ kind, text: `${kind} ${formatEnum(item)}` }]
  return [
    { kind, text: item.name },
    ...item.valuesAdded.map((value) => ({ kind: 'added' as const, text: `value ${value}` })),
    ...item.valuesRemoved.map((value) => ({ kind: 'removed' as const, text: `value ${value}` })),
  ]
}

export function SummaryEnums({ changes }: { changes: Array<[ChangeKind, EnumEntry | ModifiedEnum]> }) {
  if (changes.length === 0) return null
  return (
    <article className="rounded-md border border-border p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enums</p>
      <div className="flex flex-col gap-1 text-sm">
        {changes.flatMap(([kind, item], index) =>
          enumLines(kind, item).map((line) => (
            <p key={`enum-${index}-${line.kind}-${line.text}`} className="font-mono">
              <span className={changeClass[line.kind]}>{changeSymbol[line.kind]}</span> {line.text}
            </p>
          )),
        )}
      </div>
    </article>
  )
}
