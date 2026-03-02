// Collapsible tool use block with input/output sections.
// Used inside ContentBlockView (from AssistantMessageView and InternalGroupView).

import { Show } from 'solid-js'
import { formatInput, truncate } from '../../lib/format'
import CollapsibleBlock from './CollapsibleBlock'
import styles from '../SessionView.module.css'

export default function ToolUseBlockView(props: {
  blockKey: string
  name: string
  input: unknown
  result: { content: string; isError: boolean | null } | undefined
  expanded: Set<string>
  toggle: (key: string) => void
  tokens?: number
}) {
  return (
    <CollapsibleBlock
      role="tool"
      class={styles['tool-block']}
      expanded={props.expanded.has(props.blockKey)}
      toggle={() => props.toggle(props.blockKey)}
      tokens={props.tokens}
      label={
        <>
          <span class={styles.step}>{props.name}</span>
          <Show when={props.result?.isError}>
            <span class={styles['error-badge']}>error</span>
          </Show>
          <Show when={props.result && !props.result.isError}>
            <span class={styles['ok-badge']}>done</span>
          </Show>
        </>
      }
    >
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
    </CollapsibleBlock>
  )
}
