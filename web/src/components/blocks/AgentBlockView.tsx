import { Show } from 'solid-js'
import { A } from '@solidjs/router'
import { truncate } from '../../lib/format'
import type { SessionMessage } from '../../lib/types'
import { getAgentBlock } from '../../lib/session'
import styles from '../SessionView.module.css'

export default function AgentBlockView(props: {
  msg: SessionMessage
  toolResults: Map<string, { content: string; isError: boolean | null }>
  agentMap: Map<string, string>
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  const block = getAgentBlock(props.msg)!
  const input = block.input as {
    description?: string
    prompt?: string
    subagent_type?: string
  }
  const description = input.description ?? ''
  const subagentType = input.subagent_type ?? ''
  const result = props.toolResults.get(block.id)
  const agentId = () => props.agentMap.get(block.id)
  const key = `${props.msg.uuid}-agent`
  const outputKey = `${props.msg.uuid}-agent-output`
  return (
    <div
      class={styles['internal-single']}
      classList={{
        [styles['tool-block']]: true,
        [styles['is-expanded']]: props.expanded.has(key),
      }}
      data-role="agent"
    >
      <button
        class={styles['internal-toggle']}
        onClick={() => props.toggle(key)}
      >
        <span class={styles.caret}>
          {props.expanded.has(key) ? '\u25BE' : '\u25B8'}
        </span>
        <span class={styles['internal-steps']}>
          <span class={styles.step}>Agent</span>
          <Show when={subagentType}>
            <span class={styles['step-dot']}>&middot;</span>
            <span class={styles.step}>{subagentType}</span>
          </Show>
          <span class={styles['step-dot']}>&middot;</span>
          <span class={styles.step}>{description}</span>
        </span>
      </button>
      <Show when={props.expanded.has(key)}>
        <div class={styles['agent-expanded']}>
          <Show when={agentId()}>
            {(aid) => (
              <A
                class={styles['agent-link']}
                href={`/session/agent-${aid()}`}
              >
                View subagent session &rarr;
              </A>
            )}
          </Show>
          <Show when={result}>
            {(r) => (
              <div class={styles['agent-output-section']}>
                <button class={styles.toggle} onClick={() => props.toggle(outputKey)}>
                  {props.expanded.has(outputKey) ? '\u25BE' : '\u25B8'} Output
                </button>
                <Show when={props.expanded.has(outputKey)}>
                  <pre class={styles['agent-output']}>
                    {truncate(r().content, 5000)}
                  </pre>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  )
}
