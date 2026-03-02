// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

export function formatInput(input: unknown): string {
  if (typeof input === 'string') return input
  return JSON.stringify(input, null, 2)
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '...'
}

export type ToolResultPart =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUri: string }

export function parseToolResultParts(content: string): ToolResultPart[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const parts: ToolResultPart[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) return null
    const obj = item as Record<string, unknown>
    if (obj.type === 'image') {
      const src = obj.source as Record<string, unknown> | undefined
      if (src?.type === 'base64' && typeof src.data === 'string' && typeof src.media_type === 'string') {
        parts.push({ type: 'image', dataUri: `data:${src.media_type};base64,${src.data}` })
      } else {
        return null
      }
    } else if (obj.type === 'text' && typeof obj.text === 'string') {
      parts.push({ type: 'text', text: obj.text })
    } else {
      return null
    }
  }
  return parts
}
