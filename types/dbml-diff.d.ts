declare module 'dbml-diff' {
  export function diff(oldDbml: string, newDbml: string): unknown
  export function emitJson(result: unknown): string
  export function emitText(result: unknown): string
  export function emitMigration(result: unknown): string
  export function emitDbml(result: unknown): string
}
