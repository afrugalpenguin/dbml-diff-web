import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const MAX_LINE_LENGTH = 160

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `${dir}/${file.replaceAll('\\', '/')}`)
}

describe('source lines', () => {
  it(`keeps every line in app/, components/ and lib/ to ${MAX_LINE_LENGTH} characters`, () => {
    const long = ['app', 'components', 'lib'].flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .flatMap((line, index) => (line.length > MAX_LINE_LENGTH ? [`${file}:${index + 1} (${line.length})`] : [])),
    )
    expect(long).toEqual([])
  })
})
