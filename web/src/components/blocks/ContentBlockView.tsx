import { marked } from 'marked'
import type { SessionMessage, ContentBlock } from '../../lib/types'
import ThinkingBlockView from './ThinkingBlockView'
import ToolUseBlockView from './ToolUseBlockView'
import styles from '../SessionView.module.css'

export default function ContentBlockView(props: {
  block: ContentBlock
  msg: SessionMessage
  index: number
  expanded: Set<string>
  toggle: (key: string) => void
  toolResults: Map<string, { content: string; isError: boolean | null }>
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
          expanded={props.expanded}
          toggle={props.toggle}
        />
      </div>
    )
  }
  if (props.block.__typename === 'ToolUseBlock') {
    const key = `${props.msg.uuid}-tool-${props.index}`
    const result = props.toolResults.get(props.block.id)
    return (
      <div class={styles.block}>
        <ToolUseBlockView
          blockKey={key}
          name={props.block.name}
          input={props.block.input}
          result={result}
          expanded={props.expanded}
          toggle={props.toggle}
        />
      </div>
    )
  }
  return null
}
