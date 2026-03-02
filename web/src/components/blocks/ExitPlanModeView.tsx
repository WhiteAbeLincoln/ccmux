import { Show } from 'solid-js'
import { A } from '@solidjs/router'
import { marked } from 'marked'
import type { SessionMessage } from '../../lib/types'
import { getToolUseBlock } from '../../lib/session'
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
    <div class={`${styles.message} ${styles['exit-plan-mode']}`} data-role="exit-plan-mode">
      <div class={styles.meta}>
        <span class={styles['role-label']}>Plan</span>
        <A class={styles.uuid} href={`/session/${props.sessionId}/raw?uuid=${props.msg.uuid}`}>
          {props.msg.uuid.slice(0, 8)}
        </A>
      </div>
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
    </div>
  )
}
