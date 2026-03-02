// Read tool call with file path label and image rendering for base64 results.
// Dispatched from ContentBlockView when block.name === 'Read'.

import { Show, For } from 'solid-js'
import { truncate, parseToolResultParts } from '../../lib/format'
import CollapsibleBlock from './CollapsibleBlock'
import styles from '../SessionView.module.css'

export default function ReadBlockView(props: {
  blockKey: string
  input: unknown
  result: { content: string; isError: boolean | null } | undefined
  sessionId: string
  uuid: string
  expanded: Set<string>
  toggle: (key: string) => void
  tokens?: number
}) {
  const input = props.input as {
    file_path?: string
    offset?: number
    limit?: number
    pages?: string
  }
  const filePath = input.file_path ?? ''
  const rangeInfo = () => {
    const parts: string[] = []
    if (input.offset != null) parts.push(`offset ${input.offset}`)
    if (input.limit != null) parts.push(`limit ${input.limit}`)
    if (input.pages != null) parts.push(`pages ${input.pages}`)
    return parts.length > 0 ? parts.join(', ') : null
  }

  const parsed = () => props.result ? parseToolResultParts(props.result.content) : null

  return (
    <CollapsibleBlock
      role="tool"
      sessionId={props.sessionId}
      uuid={props.uuid}
      class={styles['tool-block']}
      expanded={props.expanded.has(props.blockKey)}
      toggle={() => props.toggle(props.blockKey)}
      tokens={props.tokens}
      label={
        <>
          <span class={styles.step}>Read</span>
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
          <pre>{filePath}</pre>
          <Show when={rangeInfo()}>
            {(info) => <pre>{info()}</pre>}
          </Show>
        </div>
        <Show when={props.result}>
          {(r) => {
            const parts = parsed()
            return (
              <div class={styles['tool-section']}>
                <div class={styles['tool-section-label']}>Output</div>
                <Show when={parts} fallback={
                  <pre classList={{ [styles['is-error']]: !!r().isError }}>
                    {truncate(r().content, 5000)}
                  </pre>
                }>
                  {(p) => (
                    <For each={p()}>
                      {(part) => (
                        <Show when={part.type === 'image' && part as { type: 'image'; dataUri: string }}
                          fallback={
                            <pre classList={{ [styles['is-error']]: !!r().isError }}>
                              {truncate((part as { type: 'text'; text: string }).text, 5000)}
                            </pre>
                          }
                        >
                          {(img) => <img class={styles['tool-image']} src={img().dataUri} />}
                        </Show>
                      )}
                    </For>
                  )}
                </Show>
              </div>
            )
          }}
        </Show>
      </div>
    </CollapsibleBlock>
  )
}
