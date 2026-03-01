import { createSignal, createResource, createMemo, For, Show, Switch, Match } from 'solid-js'
import { useParams, useNavigate, A } from '@solidjs/router'
import { query } from '../lib/graphql'
import { marked } from 'marked'
import type { SessionMessage, ContentBlock } from '../lib/types'
import styles from './SessionView.module.css'

const SESSION_QUERY = `query ($id: String!) {
  session(id: $id) {
    uuid parentUuid timestamp eventType
    userContent {
      __typename
      ... on UserTextContent { text }
      ... on UserToolResults { results { toolUseId content isError } }
    }
    assistantContent {
      model stopReason
      usage { inputTokens outputTokens cacheCreationInputTokens cacheReadInputTokens }
      blocks {
        __typename
        ... on TextBlock { text }
        ... on ThinkingBlock { thinking }
        ... on ToolUseBlock { id name input }
        ... on ToolResultBlock { toolUseId content isError }
      }
    }
    systemInfo { subtype durationMs }
  }
}`

type DisplayItem =
  | { kind: 'user'; msg: SessionMessage }
  | { kind: 'assistant'; msg: SessionMessage }
  | { kind: 'internal-group'; key: string; steps: string[]; tokens: number; msgs: SessionMessage[] }
  | { kind: 'system'; msg: SessionMessage }

function formatInput(input: unknown): string {
  if (typeof input === 'string') return input
  return JSON.stringify(input, null, 2)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '...'
}

function totalTokens(msg: SessionMessage): number | null {
  const u = msg.assistantContent?.usage
  if (!u) return null
  return (u.inputTokens ?? 0) + (u.outputTokens ?? 0)
}

function hasUserFacingText(msg: SessionMessage): boolean {
  if (!msg.assistantContent) return false
  return msg.assistantContent.blocks.some((b) => b.__typename === 'TextBlock')
}

function compactSteps(steps: string[]): { name: string; count: number }[] {
  const result: { name: string; count: number }[] = []
  for (const s of steps) {
    const last = result[result.length - 1]
    if (last && last.name === s) {
      last.count++
    } else {
      result.push({ name: s, count: 1 })
    }
  }
  return result
}

// --- Shared sub-components (same file, no separate files needed) ---

function ThinkingBlockView(props: {
  blockKey: string
  thinking: string
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  return (
    <div class={styles['thinking-block']}>
      <button class={styles.toggle} onClick={() => props.toggle(props.blockKey)}>
        {props.expanded.has(props.blockKey) ? '\u25BE' : '\u25B8'} Thinking
      </button>
      <Show when={props.expanded.has(props.blockKey)}>
        <div
          class={`${styles['thinking-content']} ${styles.prose} ${styles['prose-mono']}`}
          innerHTML={marked.parse(props.thinking) as string}
        />
      </Show>
    </div>
  )
}

function ToolUseBlockView(props: {
  blockKey: string
  name: string
  input: unknown
  result: { content: string; isError: boolean | null } | undefined
  expanded: Set<string>
  toggle: (key: string) => void
}) {
  return (
    <div class={styles['tool-block']}>
      <button class={styles.toggle} onClick={() => props.toggle(props.blockKey)}>
        {props.expanded.has(props.blockKey) ? '\u25BE' : '\u25B8'} {props.name}
        <Show when={props.result?.isError}>
          <span class={styles['error-badge']}>error</span>
        </Show>
        <Show when={props.result && !props.result.isError}>
          <span class={styles['ok-badge']}>done</span>
        </Show>
      </button>
      <Show when={props.expanded.has(props.blockKey)}>
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
      </Show>
    </div>
  )
}

// --- Main component ---

export default function SessionView() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [messages] = createResource(
    () => params.id,
    async (id) => {
      const data = await query<{ session: SessionMessage[] | null }>(SESSION_QUERY, { id })
      return data.session ?? []
    },
  )

  const toolResults = createMemo(() => {
    const map = new Map<string, { content: string; isError: boolean | null }>()
    for (const msg of messages() ?? []) {
      if (msg.userContent?.__typename === 'UserToolResults') {
        for (const r of msg.userContent.results) {
          map.set(r.toolUseId, { content: r.content, isError: r.isError })
        }
      }
    }
    return map
  })

  const displayItems = createMemo<DisplayItem[]>(() => {
    const items: DisplayItem[] = []
    let internalAcc: SessionMessage[] = []

    function flushInternal() {
      if (internalAcc.length === 0) return
      const steps: string[] = []
      let tokens = 0
      const key = `ig-${internalAcc[0].uuid}`
      for (const m of internalAcc) {
        if (m.assistantContent) {
          for (const b of m.assistantContent.blocks) {
            if (b.__typename === 'ThinkingBlock') steps.push('Thinking')
            else if (b.__typename === 'ToolUseBlock') steps.push(b.name)
          }
          const u = m.assistantContent.usage
          if (u) tokens += (u.inputTokens ?? 0) + (u.outputTokens ?? 0)
        }
      }
      items.push({ kind: 'internal-group', key, steps, tokens, msgs: internalAcc })
      internalAcc = []
    }

    for (const m of messages() ?? []) {
      if (m.eventType === 'USER' && m.userContent?.__typename === 'UserTextContent') {
        flushInternal()
        items.push({ kind: 'user', msg: m })
      } else if (m.eventType === 'ASSISTANT' && m.assistantContent) {
        if (hasUserFacingText(m)) {
          flushInternal()
          items.push({ kind: 'assistant', msg: m })
        } else {
          internalAcc.push(m)
        }
      } else if (m.eventType === 'SYSTEM' && m.systemInfo?.subtype === 'turn_duration') {
        flushInternal()
        items.push({ kind: 'system', msg: m })
      }
    }
    flushInternal()
    return items
  })

  const [expanded, setExpanded] = createSignal(new Set<string>())

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function renderBlock(block: ContentBlock, msg: SessionMessage, i: number) {
    if (block.__typename === 'TextBlock') {
      return (
        <div
          class={`${styles.block} ${styles['text-block']} ${styles.prose}`}
          innerHTML={marked.parse(block.text) as string}
        />
      )
    }
    if (block.__typename === 'ThinkingBlock') {
      const key = `${msg.uuid}-think-${i}`
      return (
        <div class={styles.block}>
          <ThinkingBlockView
            blockKey={key}
            thinking={block.thinking}
            expanded={expanded()}
            toggle={toggle}
          />
        </div>
      )
    }
    if (block.__typename === 'ToolUseBlock') {
      const key = `${msg.uuid}-tool-${i}`
      const result = toolResults().get(block.id)
      return (
        <div class={styles.block}>
          <ToolUseBlockView
            blockKey={key}
            name={block.name}
            input={block.input}
            result={result}
            expanded={expanded()}
            toggle={toggle}
          />
        </div>
      )
    }
    return null
  }

  return (
    <div class={styles['session-view']}>
      <header>
        <button onClick={() => navigate('/')}>&larr; Back</button>
        <h1>
          <A class={styles['session-link']} href={`/session/${params.id}/raw`}>
            Session {params.id.slice(0, 8)}
          </A>
        </h1>
      </header>

      <Switch>
        <Match when={messages.loading}>
          <p class={styles.status}>Loading session...</p>
        </Match>
        <Match when={messages.error}>
          <p class={`${styles.status} ${styles.error}`}>
            Error: {(messages.error as Error).message}
          </p>
        </Match>
        <Match when={true}>
          <div class={styles.messages}>
            <For each={displayItems()}>
              {(item) => (
                <Switch>
                  {/* User message */}
                  <Match when={item.kind === 'user' && item as DisplayItem & { kind: 'user' }}>
                    {(i) => (
                      <div class={`${styles.message} ${styles.user}`}>
                        <div class={styles.meta}>
                          <span class={styles['role-label']}>User</span>
                          <A class={styles.uuid} href={`/session/${params.id}/raw?uuid=${i().msg.uuid}`}>{i().msg.uuid.slice(0, 8)}</A>
                        </div>
                        <div
                          class={`${styles.content} ${styles.prose}`}
                          innerHTML={
                            marked.parse(
                              i().msg.userContent?.__typename === 'UserTextContent'
                                ? (i().msg.userContent as { text: string }).text
                                : '',
                            ) as string
                          }
                        />
                      </div>
                    )}
                  </Match>

                  {/* Assistant message with user-facing text */}
                  <Match
                    when={
                      item.kind === 'assistant' && (item as DisplayItem & { kind: 'assistant' })
                    }
                  >
                    {(i) => {
                      const msg = i().msg
                      return (
                        <div class={`${styles.message} ${styles.assistant}`}>
                          <div class={styles.meta}>
                            <span class={styles['role-label']}>Assistant</span>
                            <A class={styles.uuid} href={`/session/${params.id}/raw?uuid=${msg.uuid}`}>{msg.uuid.slice(0, 8)}</A>
                            <Show when={msg.assistantContent?.model}>
                              {(m) => <span class={styles.model}>{m()}</span>}
                            </Show>
                            <Show when={totalTokens(msg) !== null}>
                              <span class={styles.tokens}>
                                {totalTokens(msg)?.toLocaleString()} tokens
                              </span>
                            </Show>
                          </div>
                          <div class={styles.blocks}>
                            <For each={msg.assistantContent?.blocks ?? []}>
                              {(block, idx) => renderBlock(block, msg, idx())}
                            </For>
                          </div>
                        </div>
                      )
                    }}
                  </Match>

                  {/* Single-step internal group (inline) */}
                  <Match
                    when={
                      item.kind === 'internal-group' &&
                      (item as DisplayItem & { kind: 'internal-group' }).steps.length === 1 &&
                      (item as DisplayItem & { kind: 'internal-group' })
                    }
                  >
                    {(i) => (
                      <For each={i().msgs}>
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
                                      [styles['is-expanded']]: expanded().has(key),
                                    }}
                                  >
                                    <button
                                      class={styles['internal-toggle']}
                                      onClick={() => toggle(key)}
                                    >
                                      <span class={styles.caret}>
                                        {expanded().has(key) ? '\u25BE' : '\u25B8'}
                                      </span>
                                      <span class={styles['internal-steps']}>
                                        <span class={styles.step}>Thinking</span>
                                      </span>
                                      <Show when={i().tokens > 0}>
                                        <span class={styles['internal-tokens']}>
                                          {i().tokens.toLocaleString()} tok
                                        </span>
                                      </Show>
                                    </button>
                                    <Show when={expanded().has(key)}>
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
                                const result = toolResults().get(block.id)
                                return (
                                  <div
                                    class={styles['internal-single']}
                                    classList={{
                                      [styles['tool-block']]: true,
                                      [styles['is-expanded']]: expanded().has(key),
                                    }}
                                  >
                                    <button
                                      class={styles['internal-toggle']}
                                      onClick={() => toggle(key)}
                                    >
                                      <span class={styles.caret}>
                                        {expanded().has(key) ? '\u25BE' : '\u25B8'}
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
                                      <Show when={i().tokens > 0}>
                                        <span class={styles['internal-tokens']}>
                                          {i().tokens.toLocaleString()} tok
                                        </span>
                                      </Show>
                                    </button>
                                    <Show when={expanded().has(key)}>
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
                    )}
                  </Match>

                  {/* Multi-step internal group */}
                  <Match
                    when={
                      item.kind === 'internal-group' &&
                      (item as DisplayItem & { kind: 'internal-group' }).steps.length > 1 &&
                      (item as DisplayItem & { kind: 'internal-group' })
                    }
                  >
                    {(i) => (
                      <div class={styles['internal-group']}>
                        <button
                          class={styles['internal-toggle']}
                          onClick={() => toggle(i().key)}
                        >
                          <span class={styles.caret}>
                            {expanded().has(i().key) ? '\u25BE' : '\u25B8'}
                          </span>
                          <span class={styles['internal-steps']}>
                            <For each={compactSteps(i().steps)}>
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
                          <Show when={i().tokens > 0}>
                            <span class={styles['internal-tokens']}>
                              {i().tokens.toLocaleString()} tok
                            </span>
                          </Show>
                        </button>
                        <Show when={expanded().has(i().key)}>
                          <div class={styles['internal-expanded']}>
                            <For each={i().msgs}>
                              {(msg) => (
                                <For each={msg.assistantContent?.blocks ?? []}>
                                  {(block, idx) => renderBlock(block, msg, idx())}
                                </For>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Match>

                  {/* System message */}
                  <Match when={item.kind === 'system' && item.msg.systemInfo?.durationMs}>
                    <div class={`${styles.message} ${styles.system}`}>
                      Turn completed in{' '}
                      {((item as DisplayItem & { kind: 'system' }).msg.systemInfo!.durationMs! / 1000).toFixed(1)}s
                    </div>
                  </Match>
                </Switch>
              )}
            </For>
          </div>
        </Match>
      </Switch>
    </div>
  )
}
