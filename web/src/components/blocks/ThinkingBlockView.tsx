import { Show } from 'solid-js'
import { marked } from 'marked'
import styles from '../SessionView.module.css'

export default function ThinkingBlockView(props: {
  blockKey: string
  thinking: string
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  return (
    <div class={styles['thinking-block']}>
      <button class={styles.toggle} onClick={() => props.toggle(props.blockKey)}>
        {props.expanded.has(props.blockKey) ? '\u25BE' : '\u25B8'} Thinking
      </button>
      <Show when={props.expanded.has(props.blockKey)}>
        <div
          class={`${styles['thinking-content']} ${styles.prose} ${styles['prose-mono']}`}
          innerHTML={marked.parse(props.thinking) as string}
        />
      </Show>
    </div>
  )
}
