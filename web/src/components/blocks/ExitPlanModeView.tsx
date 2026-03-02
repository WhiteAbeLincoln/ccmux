// ExitPlanMode tool call rendered as a markdown plan with collapsible accepted/rejected output.
// Top-level DisplayItem kind='exit-plan-mode'.

import { Show } from 'solid-js'
import { marked } from 'marked'
import type { SessionMessage } from '../../lib/types'
import { getToolUseBlock } from '../../lib/session'
import MessageBlock from './MessageBlock'
import styles from '../SessionView.module.css'

export default function ExitPlanModeView(props: {
  msg: SessionMessage
  sessionId: string
  toolResults: Map<string, { content: string; isError: boolean | null }>
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  const block = getToolUseBlock(props.msg, 'ExitPlanMode')!
  const plan = (block.input as { plan?: string }).plan ?? ''
  const result = props.toolResults.get(block.id)
  const outputKey = `${props.msg.uuid}-plan-output`
  return (
    <MessageBlock
      variant="exit-plan-mode"
      role="exit-plan-mode"
      label="Plan"
      sessionId={props.sessionId}
      uuid={props.msg.uuid}
    >
      <div
        class={`${styles['plan-content']} ${styles.prose}`}
        innerHTML={marked.parse(plan) as string}
      />
      <Show when={result}>
        {(r) => (
          <div class={styles['plan-output']}>
            <button class={styles.toggle} onClick={() => props.toggle(outputKey)}>
              {props.expanded.has(outputKey) ? '\u25BE' : '\u25B8'} Output
              <Show when={r().content.includes('rejected')}>
                <span class={styles['error-badge']}>rejected</span>
              </Show>
              <Show when={!r().content.includes('rejected')}>
                <span class={styles['ok-badge']}>accepted</span>
              </Show>
            </button>
            <Show when={props.expanded.has(outputKey)}>
              <pre class={styles['plan-output-content']}>{r().content}</pre>
            </Show>
          </div>
        )}
      </Show>
    </MessageBlock>
  )
}
