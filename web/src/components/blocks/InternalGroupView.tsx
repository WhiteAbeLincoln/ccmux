// Non-user-facing assistant messages (thinking, tool calls) grouped into collapsible blocks.
// Single-step groups render the block directly; multi-step groups collapse behind a step summary.
// Top-level DisplayItem kind='internal-group'.

import { For, Show } from 'solid-js'
import type { SessionMessage } from '../../lib/types'
import { compactSteps } from '../../lib/session'
import ContentBlockView from './ContentBlockView'
import CollapsibleBlock from './CollapsibleBlock'
import styles from '../SessionView.module.css'

export default function InternalGroupView(props: {
  groupKey: string
  steps: string[]
  tokens: number
  msgs: SessionMessage[]
  expanded: Set<string>
  toggle: (key: string) => void
  toolResults: Map<string, { content: string; isError: boolean | null }>
}) {
  if (props.steps.length === 1) {
    return (
      <For each={props.msgs}>
        {(msg) => (
          <For each={msg.assistantContent?.blocks ?? []}>
            {(block, idx) => (
              <ContentBlockView
                block={block}
                msg={msg}
                index={idx()}
                expanded={props.expanded}
                toggle={props.toggle}
                toolResults={props.toolResults}
                tokens={props.tokens}
              />
            )}
          </For>
        )}
      </For>
    )
  }

  return (
    <CollapsibleBlock
      role="internal-group"
      class={styles['internal-group']}
      expanded={props.expanded.has(props.groupKey)}
      toggle={() => props.toggle(props.groupKey)}
      tokens={props.tokens}
      label={
        <For each={compactSteps(props.steps)}>
          {(step, si) => (
            <>
              <Show when={si() > 0}>
                <span class={styles['step-dot']}>&middot;</span>
              </Show>
              <span class={styles.step}>
                {step.name}
                <Show when={step.count > 1}>
                  {' '}
                  &times;{step.count}
                </Show>
              </span>
            </>
          )}
        </For>
      }
    >
      <div class={styles['internal-expanded']}>
        <For each={props.msgs}>
          {(msg) => (
            <For each={msg.assistantContent?.blocks ?? []}>
              {(block, idx) => (
                <ContentBlockView
                  block={block}
                  msg={msg}
                  index={idx()}
                  expanded={props.expanded}
                  toggle={props.toggle}
                  toolResults={props.toolResults}
                />
              )}
            </For>
          )}
        </For>
      </div>
    </CollapsibleBlock>
  )
}
