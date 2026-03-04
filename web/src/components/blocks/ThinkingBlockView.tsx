// Collapsible thinking block with markdown-rendered content.
// Used inside ContentBlockView (from AssistantMessageView and InternalGroupView).

import CollapsibleBlock from './CollapsibleBlock'
import Prose from '../Prose'
import tb from './ThinkingBlockView.module.css'
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
      meta={{ sessionId: props.sessionId, uuid: props.uuid, tokens: props.tokens }}
      class={tb['thinking-block']}
      expanded={props.expanded.has(props.blockKey)}
      toggle={() => props.toggle(props.blockKey)}
      label={<span class={styles.step}>Thinking</span>}
    >
      <Prose
        text={props.thinking}
        class={tb['thinking-content']}
        classList={{ [tb['prose-mono']]: true }}
      />
    </CollapsibleBlock>
  )
}
