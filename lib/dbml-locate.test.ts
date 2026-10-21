import { describe, expect, it } from 'vitest'
import { editorFocusLine, findDbmlLine } from './dbml-locate'

const dbml = [
  'Table users {', // 1
  '  id int [pk]', // 2
  '  user_id int', // 3
  '  user int', // 4
  '}', // 5
  '', // 6
  'Table orders {', // 7
  '  id int [pk]', // 8
  '  user_id int', // 9
  '  Indexes {', // 10
  '    (id, user_id) [unique]', // 11
  '  }', // 12
  '}', // 13
].join('\n')

describe('findDbmlLine', () => {
  it('finds a column inside its own table when another table has the same column', () => {
    expect(findDbmlLine(dbml, 'orders', 'user_id')).toBe(9)
    expect(findDbmlLine(dbml, 'users', 'user_id')).toBe(3)
  })

  it('does not match a column whose name only starts with the wanted name', () => {
    expect(findDbmlLine(dbml, 'users', 'user')).toBe(4)
    expect(findDbmlLine(dbml, 'orders', 'user')).toBeUndefined()
  })

  it('finds the table line for a table-level item', () => {
    expect(findDbmlLine(dbml, 'orders')).toBe(7)
  })

  it('returns nothing when the table or column is missing', () => {
    expect(findDbmlLine(dbml, 'missing')).toBeUndefined()
    expect(findDbmlLine(dbml, 'users', 'missing')).toBeUndefined()
  })

  it('does not treat lines in nested blocks as columns', () => {
    expect(findDbmlLine('Table t {\n  Indexes {\n    a [pk]\n  }\n  a int\n}', 't', 'a')).toBe(5)
  })

  it('matches schema-qualified, quoted and default-schema names the way dbml-diff reports them', () => {
    const source = [
      'TABLE dbo.Shipments {',
      '  Id int',
      '}',
      'Table "app"."Ship Ments" as S [headercolor: #fff] {',
      '  "Id Col" int',
      '}',
      'table public.accounts {',
      '  id int',
      '}',
    ].join('\n')
    expect(findDbmlLine(source, 'dbo.Shipments', 'Id')).toBe(2)
    expect(findDbmlLine(source, 'app.Ship Ments', 'Id Col')).toBe(5)
    expect(findDbmlLine(source, 'accounts', 'id')).toBe(8)
  })

  it('ignores braces inside notes and strings', () => {
    const source = "Table t {\n  a int [note: 'uses { and }']\n  Note: '''\n  }\n  '''\n  b int\n}\nTable u {\n  b int\n}"
    expect(findDbmlLine(source, 't', 'b')).toBe(6)
    expect(findDbmlLine(source, 'u', 'b')).toBe(9)
  })

  it('ignores commented-out lines', () => {
    expect(findDbmlLine('Table t {\n  // a int\n  a int\n}', 't', 'a')).toBe(3)
  })
})

describe('editorFocusLine', () => {
  const oldDbml = 'Table t {\n  id int\n  a int\n}'
  const newDbml = 'Table u {\n  id int\n}\nTable t {\n  id int\n}'

  it('looks the line up in the schema the item belongs to', () => {
    expect(editorFocusLine({ schema: 'old', table: 't', column: 'a' }, oldDbml, newDbml)).toEqual({ schema: 'old', line: 3 })
    expect(editorFocusLine({ schema: 'new', table: 't', column: 'id' }, oldDbml, newDbml)).toEqual({ schema: 'new', line: 5 })
  })

  it('returns nothing when the line is not in the current schema text', () => {
    expect(editorFocusLine({ schema: 'new', table: 't', column: 'a' }, oldDbml, newDbml)).toBeNull()
  })
})
