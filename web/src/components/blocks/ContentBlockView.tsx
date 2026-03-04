// Dispatcher that renders an individual ContentBlock (text, thinking, or tool use).
// Used inside AssistantMessageView and InternalGroupView.

import type { SessionMessage, ContentBlock } from '../../lib/types'
import Prose from '../Prose'
import ThinkingBlockView from './ThinkingBlockView'
import ToolUseBlockView from './ToolUseBlockView'
import ReadBlockView from './ReadBlockView'
import EditBlockView from './EditBlockView'
import WriteBlockView from './WriteBlockView'
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
      <Prose
        text={props.block.text}
        class={`${styles.block} ${styles['text-block']}`}
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
    if (props.block.name === 'Edit') {
      return (
        <div class={styles.block}>
          <EditBlockView
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
    if (props.block.name === 'Write') {
      return (
        <div class={styles.block}>
          <WriteBlockView
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
