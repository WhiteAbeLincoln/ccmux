import type { JSX, ParentProps } from 'solid-js'
import { Show } from 'solid-js'
import styles from '../SessionView.module.css'

export default function CollapsibleBlock(props: ParentProps<{
  expanded: boolean
  toggle: () => void
  role: string
  class?: string
  classList?: Record<string, boolean | undefined>
  label: JSX.Element
  tokens?: number
}>) {
  return (
    <div class={props.class} classList={{ ...props.classList, [styles['is-expanded']]: props.expanded }} data-role={props.role}>
      <button class={styles['internal-toggle']} onClick={() => props.toggle()}>
        <span class={styles.caret}>
          {props.expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span class={styles['internal-steps']}>
          {props.label}
        </span>
        <Show when={props.tokens != null && props.tokens! > 0}>
          <span class={styles['internal-tokens']}>
            {props.tokens!.toLocaleString()} tok
          </span>
        </Show>
      </button>
      <Show when={props.expanded}>
        {props.children}
      </Show>
    </div>
  )
}
