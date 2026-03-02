// Assistant response with model/token metadata and content blocks. Top-level DisplayItem kind='assistant'.

import { For, Show } from 'solid-js'
import type { SessionMessage } from '../../lib/types'
import { totalTokens } from '../../lib/session'
import ContentBlockView from './ContentBlockView'
import MessageBlock from './MessageBlock'
import styles from '../SessionView.module.css'

export default function AssistantMessageView(props: {
  msg: SessionMessage
  sessionId: string
  expanded: Set<string>
  toggle: (key: string) => void
  toolResults: Map<string, { content: string; isError: boolean | null }>
}) {
  return (
    <MessageBlock
      variant="assistant"
      role="assistant"
      label="Assistant"
      sessionId={props.sessionId}
      uuid={props.msg.uuid}
      extraMeta={
        <Show when={props.msg.assistantContent?.model}>
          {(m) => <span class={styles.model}>{m()}</span>}
        </Show>
      }
      rightMeta={
        <Show when={totalTokens(props.msg) !== null}>
          <span class={styles['internal-tokens']}>
            {totalTokens(props.msg)?.toLocaleString()} tok
          </span>
        </Show>
      }
    >
      <div class={styles.blocks}>
        <For each={props.msg.assistantContent?.blocks ?? []}>
          {(block, idx) => (
            <ContentBlockView
              block={block}
              msg={props.msg}
              index={idx()}
              sessionId={props.sessionId}
              expanded={props.expanded}
              toggle={props.toggle}
              toolResults={props.toolResults}
            />
          )}
        </For>
      </div>
    </MessageBlock>
  )
}
