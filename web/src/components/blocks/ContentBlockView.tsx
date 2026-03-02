// Dispatcher that renders an individual ContentBlock (text, thinking, or tool use).
// Used inside AssistantMessageView and InternalGroupView.

import { marked } from 'marked'
import type { SessionMessage, ContentBlock } from '../../lib/types'
import ThinkingBlockView from './ThinkingBlockView'
import ToolUseBlockView from './ToolUseBlockView'
import ReadBlockView from './ReadBlockView'
import styles from '../SessionView.module.css'

export default function ContentBlockView(props: {
  block: ContentBlock
  msg: SessionMessage
  index: number
  sessionId: string
  expanded: Set<string>
  toggle: (key: string) => void
  toolResults: Map<string, { content: string; isError: boolean | null }>
  tokens?: number
}) {
  if (props.block.__typename === 'TextBlock') {
    return (
      <div
        class={`${styles.block} ${styles['text-block']} ${styles.prose}`}
        innerHTML={marked.parse(props.block.text) as string}
      />
    )
  }
  if (props.block.__typename === 'ThinkingBlock') {
    const key = `${props.msg.uuid}-think-${props.index}`
    return (
      <div class={styles.block}>
        <ThinkingBlockView
          blockKey={key}
          thinking={props.block.thinking}
          sessionId={props.sessionId}
          uuid={props.msg.uuid}
          expanded={props.expanded}
          toggle={props.toggle}
          tokens={props.tokens}
        />
      </div>
    )
  }
  if (props.block.__typename === 'ToolUseBlock') {
    const key = `${props.msg.uuid}-tool-${props.index}`
    const result = props.toolResults.get(props.block.id)
    if (props.block.name === 'Read') {
      return (
        <div class={styles.block}>
          <ReadBlockView
            blockKey={key}
            input={props.block.input}
            result={result}
            sessionId={props.sessionId}
            uuid={props.msg.uuid}
            expanded={props.expanded}
            toggle={props.toggle}
            tokens={props.tokens}
          />
        </div>
      )
    }
    return (
      <div class={styles.block}>
        <ToolUseBlockView
          blockKey={key}
          name={props.block.name}
          input={props.block.input}
          result={result}
          sessionId={props.sessionId}
          uuid={props.msg.uuid}
          expanded={props.expanded}
          toggle={props.toggle}
          tokens={props.tokens}
        />
      </div>
    )
  }
  return null
}
