import { truncateName, type GroupMove, type GroupSection } from '../../lib/summary-groups'

function Name({ value }: { value: string }) {
  return (
    <span title={value} className="whitespace-nowrap">
      {truncateName(value)}
    </span>
  )
}

export function SummaryGroups({
  moves,
  sections,
  count,
  open,
  onToggle,
  matches,
  display,
}: {
  moves: GroupMove[]
  sections: GroupSection[]
  count: number
  open: boolean
  onToggle: () => void
  matches: (value: string) => boolean
  display: (name: string) => string
}) {
  return (
    <article id="summary-groups" className="w-full rounded-md border border-border p-4">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <span aria-hidden="true">{open ? '⌄' : '›'}</span>Groups <span className="font-mono">{count}</span>
      </button>
      {open && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2">Table</th>
                  <th className="pb-2">From group</th>
                  <th className="pb-2">To group</th>
                </tr>
              </thead>
              <tbody>
                {moves
                  .filter((move) => matches(`${move.table} ${move.from} ${move.to}`))
                  .map((move) => (
                    <tr key={`move-${move.table}`} className="border-t border-border">
                      <td className="py-2 font-mono">
                        <span className="mr-2 text-amber-500">{'\u21aa'}</span>
                        <Name value={display(move.table)} />
                      </td>
                      <td className="py-2">{move.from}</td>
                      <td className="py-2">{move.to}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {sections
              .filter((group) => group.additions.length || group.removals.length)
              .map((group) => (
                <section key={group.name}>
                  <h4 className="mb-2 font-mono text-sm font-semibold">{group.name}</h4>
                  <div className="flex flex-col gap-1 font-mono text-sm">
                    {group.additions
                      .filter((table) => matches(`${group.name} ${table}`))
                      .map((table) => (
                        <div key={`+${group.name}-${table}`}>
                          <span className="mr-2 text-emerald-500">+</span>
                          <Name value={display(table)} />
                        </div>
                      ))}
                    {group.removals
                      .filter((table) => matches(`${group.name} ${table}`))
                      .map((table) => (
                        <div key={`-${group.name}-${table}`}>
                          <span className="mr-2 text-red-500">-</span>
                          <Name value={display(table)} />
                        </div>
                      ))}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}
    </article>
  )
}
