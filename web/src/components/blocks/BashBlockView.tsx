import { Show } from 'solid-js'
import { stripAnsi } from '../../lib/format'
import type { SessionMessage } from '../../lib/types'
import { getToolUseBlock } from '../../lib/session'
import HighlightedBash from './HighlightedBash'
import styles from '../SessionView.module.css'

export default function BashBlockView(props: {
  msg: SessionMessage
  toolResults: Map<string, { content: string; isError: boolean | null }>
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  const block = getToolUseBlock(props.msg, 'Bash')!
  const input = block.input as { command?: string; description?: string }
  const command = input.command ?? ''
  const description = input.description ?? ''
  const result = props.toolResults.get(block.id)
  const outputKey = `${props.msg.uuid}-bash-output`
  return (
    <div class={`${styles.message} ${styles.bash}`} data-role="bash">
      <div class={styles['bash-header']}>
        <span class={styles['bash-prompt']}>$</span>
        <span class={styles['bash-desc']}>{description}</span>
        <Show when={result?.isError}>
          <span class={styles['error-badge']}>error</span>
        </Show>
      </div>
      <HighlightedBash code={command} />
      <Show when={result}>
        {(r) => (
          <div class={styles['bash-output-section']}>
            <button class={styles.toggle} onClick={() => props.toggle(outputKey)}>
              {props.expanded.has(outputKey) ? '\u25BE' : '\u25B8'} Output
            </button>
            <Show when={props.expanded.has(outputKey)}>
              <pre
                class={styles['bash-output']}
                classList={{ [styles['is-error']]: !!r().isError }}
              >{stripAnsi(r().content)}</pre>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
