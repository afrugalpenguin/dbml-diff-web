import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { gzipSync } from 'node:zlib'
import { encodeComparison } from '../../../lib/share-storage'

const get = vi.fn()
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })

vi.mock('@upstash/redis', () => ({ Redis: class { get = get } }))
vi.mock('next/navigation', () => ({ notFound }))

const valid = {
  id: 'Abcdef1234', oldDbml: 'Table A {}', newDbml: 'Table A {}', createdAt: '2026-01-02T00:00:00.000Z',
  parsedResult: {}, text: 'diff text', migration: '', dbml: '',
}

describe('shared comparison page', () => {
  beforeEach(() => { get.mockReset(); notFound.mockClear() })

  it('rejects malformed ids before Redis access', async () => {
    const { default: Page } = await import('./page')
    await expect(Page({ params: Promise.resolve({ id: 'bad' }) })).rejects.toThrow('NOT_FOUND')
    expect(get).not.toHaveBeenCalled()
  })

  it('maps missing, corrupt, and wrong-shape values to not found', async () => {
    const { default: Page } = await import('./page')
    const corruptGzip = { encoding: 'gzip+base64', data: Buffer.from('not gzip').toString('base64') }
    const invalidJson = { encoding: 'gzip+base64', data: gzipSync(Buffer.from('not json')).toString('base64') }
    for (const value of [null, 'not gzip', { id: valid.id }, corruptGzip, invalidJson, encodeComparison({ ...valid, createdAt: 'not a date' })]) {
      get.mockResolvedValueOnce(value)
      await expect(Page({ params: Promise.resolve({ id: valid.id }) })).rejects.toThrow('NOT_FOUND')
    }
  })

  it('renders a valid share text and date', async () => {
    get.mockResolvedValue(encodeComparison(valid))
    const { default: Page } = await import('./page')
    const markup = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: valid.id }) }))
    expect(markup).toContain('diff text')
    expect(markup).toContain(`Created ${new Date(valid.createdAt).toLocaleString()}`)
  })
})
