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
