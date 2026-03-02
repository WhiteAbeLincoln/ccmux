import { For, Show } from 'solid-js'
import { marked } from 'marked'
import { formatInput, truncate } from '../../lib/format'
import type { SessionMessage } from '../../lib/types'
import { compactSteps } from '../../lib/session'
import ContentBlockView from './ContentBlockView'
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
            {(block, idx) => {
              if (block.__typename === 'ThinkingBlock') {
                const key = `${msg.uuid}-think-${idx()}`
                return (
                  <div
                    class={styles['internal-single']}
                    classList={{
                      [styles['thinking-block']]: true,
                      [styles['is-expanded']]: props.expanded.has(key),
                    }}
                  >
                    <button
                      class={styles['internal-toggle']}
                      onClick={() => props.toggle(key)}
                    >
                      <span class={styles.caret}>
                        {props.expanded.has(key) ? '\u25BE' : '\u25B8'}
                      </span>
                      <span class={styles['internal-steps']}>
                        <span class={styles.step}>Thinking</span>
                      </span>
                      <Show when={props.tokens > 0}>
                        <span class={styles['internal-tokens']}>
                          {props.tokens.toLocaleString()} tok
                        </span>
                      </Show>
                    </button>
                    <Show when={props.expanded.has(key)}>
                      <div
                        class={`${styles['thinking-content']} ${styles.prose} ${styles['prose-mono']}`}
                        innerHTML={marked.parse(block.thinking) as string}
                      />
                    </Show>
                  </div>
                )
              }
              if (block.__typename === 'ToolUseBlock') {
                const key = `${msg.uuid}-tool-${idx()}`
                const result = props.toolResults.get(block.id)
                return (
                  <div
                    class={styles['internal-single']}
                    classList={{
                      [styles['tool-block']]: true,
                      [styles['is-expanded']]: props.expanded.has(key),
                    }}
                  >
                    <button
                      class={styles['internal-toggle']}
                      onClick={() => props.toggle(key)}
                    >
                      <span class={styles.caret}>
                        {props.expanded.has(key) ? '\u25BE' : '\u25B8'}
                      </span>
                      <span class={styles['internal-steps']}>
                        <span class={styles.step}>{block.name}</span>
                        <Show when={result?.isError}>
                          <span class={styles['error-badge']}>error</span>
                        </Show>
                        <Show when={result && !result.isError}>
                          <span class={styles['ok-badge']}>done</span>
                        </Show>
                      </span>
                      <Show when={props.tokens > 0}>
                        <span class={styles['internal-tokens']}>
                          {props.tokens.toLocaleString()} tok
                        </span>
                      </Show>
                    </button>
                    <Show when={props.expanded.has(key)}>
                      <div class={styles['tool-details']}>
                        <div class={styles['tool-section']}>
                          <div class={styles['tool-section-label']}>Input</div>
                          <pre>{formatInput(block.input)}</pre>
                        </div>
                        <Show when={result}>
                          {(r) => (
                            <div class={styles['tool-section']}>
                              <div class={styles['tool-section-label']}>Output</div>
                              <pre
                                classList={{
                                  [styles['is-error']]: !!r().isError,
                                }}
                              >
                                {truncate(r().content, 5000)}
                              </pre>
                            </div>
                          )}
                        </Show>
                      </div>
                    </Show>
                  </div>
                )
              }
              return null
            }}
          </For>
        )}
      </For>
    )
  }

  return (
    <div class={styles['internal-group']} data-role="internal-group">
      <button
        class={styles['internal-toggle']}
        onClick={() => props.toggle(props.groupKey)}
      >
        <span class={styles.caret}>
          {props.expanded.has(props.groupKey) ? '\u25BE' : '\u25B8'}
        </span>
        <span class={styles['internal-steps']}>
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
        </span>
        <Show when={props.tokens > 0}>
          <span class={styles['internal-tokens']}>
            {props.tokens.toLocaleString()} tok
          </span>
        </Show>
      </button>
      <Show when={props.expanded.has(props.groupKey)}>
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
      </Show>
    </div>
  )
}
