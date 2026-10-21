import { Redis } from '@upstash/redis'
import { notFound } from 'next/navigation'
import { decodeComparison } from '../../../lib/share-storage'
import { decodeStoredComparison, isValidShareId } from '../../../lib/share-validation'

const redis = new Redis({ url: process.env.KV_REST_API_URL ?? '', token: process.env.KV_REST_API_READ_ONLY_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '' })

export const runtime = 'nodejs'

export default async function SharedComparison({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidShareId(id)) notFound()
  let comparison: ReturnType<typeof decodeStoredComparison>
  try {
    const stored = await redis.get(`comparison:${id}`)
    comparison = decodeStoredComparison(decodeComparison(stored))
  } catch {
    notFound()
  }
  if (!comparison) notFound()
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="mb-2 text-sm font-semibold text-muted-foreground">DBML-DIFF / READ-ONLY SHARE</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Schema comparison <span className="font-mono text-muted-foreground">{id}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Created {new Date(comparison.createdAt).toLocaleString()}</p>
        <pre className="mt-8 overflow-auto rounded-2xl border border-border bg-card p-6 font-mono text-sm leading-6">
          {comparison.text}
        </pre>
      </div>
    </main>
  )
}
