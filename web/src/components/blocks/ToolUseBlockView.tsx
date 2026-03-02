import { Show } from 'solid-js'
import { formatInput, truncate } from '../../lib/format'
import styles from '../SessionView.module.css'

export default function ToolUseBlockView(props: {
  blockKey: string
  name: string
  input: unknown
  result: { content: string; isError: boolean | null } | undefined
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  return (
    <div class={styles['tool-block']}>
      <button class={styles.toggle} onClick={() => props.toggle(props.blockKey)}>
        {props.expanded.has(props.blockKey) ? '\u25BE' : '\u25B8'} {props.name}
        <Show when={props.result?.isError}>
          <span class={styles['error-badge']}>error</span>
        </Show>
        <Show when={props.result && !props.result.isError}>
          <span class={styles['ok-badge']}>done</span>
        </Show>
      </button>
      <Show when={props.expanded.has(props.blockKey)}>
        <div class={styles['tool-details']}>
          <div class={styles['tool-section']}>
            <div class={styles['tool-section-label']}>Input</div>
            <pre>{formatInput(props.input)}</pre>
          </div>
          <Show when={props.result}>
            {(r) => (
              <div class={styles['tool-section']}>
                <div class={styles['tool-section-label']}>Output</div>
                <pre classList={{ [styles['is-error']]: !!r().isError }}>
                  {truncate(r().content, 5000)}
                </pre>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  )
}
