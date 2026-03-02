import type { SessionMessage, ToolUseBlock } from './types'

export function getToolUseBlock(msg: SessionMessage, name: string): ToolUseBlock | null {
  if (!msg.assistantContent) return null
  return (
    (msg.assistantContent.blocks.find(
      (b): b is ToolUseBlock => b.__typename === 'ToolUseBlock' && b.name === name,
    ) as ToolUseBlock) ?? null
  )
}

export function getAgentBlock(msg: SessionMessage): ToolUseBlock | null {
  return getToolUseBlock(msg, 'Task') ?? getToolUseBlock(msg, 'Agent')
}

export function hasUserFacingText(msg: SessionMessage): boolean {
  if (!msg.assistantContent) return false
  return msg.assistantContent.blocks.some((b) => b.__typename === 'TextBlock')
}

export function totalTokens(msg: SessionMessage): number | null {
  const u = msg.assistantContent?.usage
  if (!u) return null
  return (u.inputTokens ?? 0) + (u.outputTokens ?? 0)
}

export function compactSteps(steps: string[]): { name: string; count: number }[] {
  const result: { name: string; count: number }[] = []
  for (const s of steps) {
    const last = result[result.length - 1]
    if (last && last.name === s) {
      last.count++
    } else {
      result.push({ name: s, count: 1 })
    }
  }
  return result
}
