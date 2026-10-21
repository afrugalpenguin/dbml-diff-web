import { ExternalLink } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer
      className={
        'mt-16 flex flex-col items-start gap-2 border-t border-border pt-6 text-sm text-muted-foreground ' +
        'sm:flex-row sm:items-center sm:justify-between'
      }
    >
      <nav aria-label="Project links" className="flex items-center gap-4">
        <span>dbml-diff</span>
        <span aria-hidden="true">-</span>
        <a
          href="https://github.com/afrugalpenguin/dbml-diff"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          GitHub <ExternalLink className="size-3" aria-hidden="true" />
        </a>
        <a
          href="https://www.npmjs.com/package/dbml-diff"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          npm <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </nav>
      <p>Comparisons aren&apos;t stored unless you share them.</p>
    </footer>
  )
}
