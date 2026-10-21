import { ExternalLink, GitCompareArrows } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GitCompareArrows />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">dbml-diff</p>
            <p className="text-xs text-muted-foreground">Schema changes, made clear.</p>
          </div>
        </div>
        <a
          href="https://github.com/afrugalpenguin/dbml-diff"
          target="_blank"
          rel="noopener"
          className={
            'hidden items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground ' +
            'transition-colors hover:text-foreground sm:inline-flex'
          }
        >
          powered by dbml-diff {process.env.NEXT_PUBLIC_DBML_DIFF_VERSION}{' '}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}
