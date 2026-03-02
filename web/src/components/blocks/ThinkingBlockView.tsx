// Collapsible thinking block with markdown-rendered content.
// Used inside ContentBlockView (from AssistantMessageView and InternalGroupView).

import { marked } from 'marked'
import CollapsibleBlock from './CollapsibleBlock'
import styles from '../SessionView.module.css'

export default function ThinkingBlockView(props: {
  blockKey: string
  thinking: string
  sessionId: string
  uuid: string
  expanded: Set<string>
  toggle: (key: string) => void
  tokens?: number
}) {
  return (
    <CollapsibleBlock
      role="thinking"
      sessionId={props.sessionId}
      uuid={props.uuid}
      class={styles['thinking-block']}
      expanded={props.expanded.has(props.blockKey)}
      toggle={() => props.toggle(props.blockKey)}
      tokens={props.tokens}
      label={<span class={styles.step}>Thinking</span>}
    >
      <div
        class={`${styles['thinking-content']} ${styles.prose} ${styles['prose-mono']}`}
        innerHTML={marked.parse(props.thinking) as string}
      />
    </CollapsibleBlock>
  )
}
