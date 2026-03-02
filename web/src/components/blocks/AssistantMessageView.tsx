import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'
import type { SessionMessage } from '../../lib/types'
import { totalTokens } from '../../lib/session'
import ContentBlockView from './ContentBlockView'
import styles from '../SessionView.module.css'

export default function AssistantMessageView(props: {
  msg: SessionMessage
  sessionId: string
  expanded: Set<string>
  toggle: (key: string) => void
  toolResults: Map<string, { content: string; isError: boolean | null }>
}) {
  return (
    <div class={`${styles.message} ${styles.assistant}`} data-role="assistant">
      <div class={styles.meta}>
        <span class={styles['role-label']}>Assistant</span>
        <A class={styles.uuid} href={`/session/${props.sessionId}/raw?uuid=${props.msg.uuid}`}>
          {props.msg.uuid.slice(0, 8)}
        </A>
        <Show when={props.msg.assistantContent?.model}>
          {(m) => <span class={styles.model}>{m()}</span>}
        </Show>
        <Show when={totalTokens(props.msg) !== null}>
          <span class={styles.tokens}>
            {totalTokens(props.msg)?.toLocaleString()} tokens
          </span>
        </Show>
      </div>
      <div class={styles.blocks}>
        <For each={props.msg.assistantContent?.blocks ?? []}>
          {(block, idx) => (
            <ContentBlockView
              block={block}
              msg={props.msg}
              index={idx()}
              expanded={props.expanded}
              toggle={props.toggle}
              toolResults={props.toolResults}
            />
          )}
        </For>
      </div>
    </div>
  )
}
