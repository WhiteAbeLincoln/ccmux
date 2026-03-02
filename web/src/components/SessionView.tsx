import { createSignal, createResource, createMemo, For, Show, Switch, Match } from 'solid-js'
import { useParams, useNavigate, A } from '@solidjs/router'
import { query } from '../lib/graphql'
import { marked } from 'marked'
import { createHighlighter, type Highlighter } from 'shiki'
import type { SessionMessage, ContentBlock, ToolUseBlock } from '../lib/types'

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

let _highlighter: Promise<Highlighter> | null = null
function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = createHighlighter({
      themes: ['vitesse-dark', 'vitesse-light'],
      langs: ['bash'],
    })
  }
  return _highlighter
}
import styles from './SessionView.module.css'

const SESSION_INFO_QUERY = `query ($id: String!) {
  sessionInfo(id: $id) {
    id isSidechain parentSessionId agentId firstMessage
  }
}`

const AGENT_MAP_QUERY = `query ($id: String!) {
  sessionAgentMap(id: $id) { toolUseId agentId }
}`

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
  | { kind: 'ask-user-question'; msg: SessionMessage }
  | { kind: 'exit-plan-mode'; msg: SessionMessage }
  | { kind: 'bash'; msg: SessionMessage }
  | { kind: 'agent'; msg: SessionMessage }
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

interface AskUserQuestion {
  question: string
  header: string
  options: { label: string; description: string }[]
  multiSelect: boolean
}

function getToolUseBlock(msg: SessionMessage, name: string): ToolUseBlock | null {
  if (!msg.assistantContent) return null
  return (
    (msg.assistantContent.blocks.find(
      (b): b is ToolUseBlock => b.__typename === 'ToolUseBlock' && b.name === name,
    ) as ToolUseBlock) ?? null
  )
}

function getAgentBlock(msg: SessionMessage): ToolUseBlock | null {
  return getToolUseBlock(msg, 'Task') ?? getToolUseBlock(msg, 'Agent')
}

function parseAskUserAnswers(resultContent: string): Map<string, string> {
  const answers = new Map<string, string>()
  const regex = /"([^"]+)"="([^"]+)"/g
  let match
  while ((match = regex.exec(resultContent)) !== null) {
    answers.set(match[1], match[2])
  }
  return answers
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

function AskUserQuestionView(props: {
  questions: AskUserQuestion[]
  answers: Map<string, string>
}) {
  return (
    <div class={styles['ask-questions']} data-component="ask-user-question">
      <For each={props.questions}>
        {(q) => {
          const answer = () => props.answers.get(q.question)
          return (
            <div class={styles['question-group']} data-question={q.header}>
              <div class={styles['question-header']}>
                <span class={styles['question-badge']}>{q.header}</span>
                {q.multiSelect && <span class={styles['multi-badge']}>multi</span>}
              </div>
              <div class={styles['question-text']}>{q.question}</div>
              <div class={styles['question-options']}>
                <For each={q.options}>
                  {(opt) => {
                    const selected = () => answer() === opt.label
                    return (
                      <div
                        class={styles['question-option']}
                        classList={{ [styles['option-selected']]: selected() }}
                        data-selected={selected() ? 'true' : undefined}
                      >
                        <span class={styles['option-indicator']}>
                          {selected() ? '\u25CF' : '\u25CB'}
                        </span>
                        <div>
                          <span class={styles['option-label']}>{opt.label}</span>
                          <span class={styles['option-desc']}>{opt.description}</span>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}

function HighlightedBash(props: { code: string }) {
  const [html] = createResource(
    () => props.code,
    async (code) => {
      const hl = await getHighlighter()
      return hl.codeToHtml(code, {
        lang: 'bash',
        themes: { dark: 'vitesse-dark', light: 'vitesse-light' },
        defaultColor: false,
      })
    },
  )
  return (
    <Show when={html()} fallback={<pre class={styles['bash-command']}><code>{props.code}</code></pre>}>
      {(h) => <div class={styles['bash-command']} innerHTML={h()} />}
    </Show>
  )
}

// --- Main component ---

export default function SessionView() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()

  interface SessionInfoData {
    id: string
    isSidechain: boolean
    parentSessionId: string | null
    agentId: string | null
    firstMessage: string | null
  }

  const [sessionInfo] = createResource(
    () => params.id,
    async (id) => {
      const data = await query<{ sessionInfo: SessionInfoData | null }>(SESSION_INFO_QUERY, { id })
      return data.sessionInfo
    },
  )

  const [messages] = createResource(
    () => params.id,
    async (id) => {
      const data = await query<{ session: SessionMessage[] | null }>(SESSION_QUERY, { id })
      return data.session ?? []
    },
  )

  const [agentMapRaw] = createResource(
    () => params.id,
    async (id) => {
      const data = await query<{
        sessionAgentMap: { toolUseId: string; agentId: string }[]
      }>(AGENT_MAP_QUERY, { id })
      return data.sessionAgentMap ?? []
    },
  )

  const agentMap = createMemo(() => {
    const map = new Map<string, string>()
    for (const m of agentMapRaw() ?? []) {
      map.set(m.toolUseId, m.agentId)
    }
    return map
  })

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
        } else if (getToolUseBlock(m, 'AskUserQuestion')) {
          flushInternal()
          items.push({ kind: 'ask-user-question', msg: m })
        } else if (getToolUseBlock(m, 'ExitPlanMode')) {
          flushInternal()
          items.push({ kind: 'exit-plan-mode', msg: m })
        } else if (getToolUseBlock(m, 'Bash')) {
          flushInternal()
          items.push({ kind: 'bash', msg: m })
        } else if (getAgentBlock(m)) {
          flushInternal()
          items.push({ kind: 'agent', msg: m })
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
        <Show when={sessionInfo()?.isSidechain && sessionInfo()?.parentSessionId}>
          <button onClick={() => navigate(`/session/${sessionInfo()!.parentSessionId}`)}>&larr; Parent</button>
        </Show>
        <Show when={!sessionInfo()?.isSidechain}>
          <button onClick={() => navigate('/')}>&larr; Back</button>
        </Show>
        <h1>
          <A class={styles['session-link']} href={`/session/${params.id}/raw`}>
            <Show when={sessionInfo()?.isSidechain} fallback={<>Session {params.id.slice(0, 8)}</>}>
              Subagent {params.id.replace('agent-', '').slice(0, 8)}
            </Show>
          </A>
        </h1>
      </header>

      <Show when={sessionInfo()?.isSidechain}>
        {(_) => {
          const info = sessionInfo()!
          const lastAssistantText = createMemo(() => {
            const msgs = messages() ?? []
            for (let j = msgs.length - 1; j >= 0; j--) {
              const m = msgs[j]
              if (m.assistantContent) {
                for (const b of m.assistantContent.blocks) {
                  if (b.__typename === 'TextBlock') return b.text
                }
              }
            }
            return null
          })
          return (
            <div class={styles['subagent-header']} data-role="subagent-header">
              <div class={styles['subagent-section']}>
                <div class={styles['subagent-label']}>Prompt</div>
                <div class={styles['subagent-text']}>{info.firstMessage}</div>
              </div>
              <Show when={lastAssistantText()}>
                {(text) => (
                  <div class={styles['subagent-section']}>
                    <div class={styles['subagent-label']}>Output</div>
                    <div
                      class={`${styles['subagent-text']} ${styles.prose}`}
                      innerHTML={marked.parse(truncate(text(), 3000)) as string}
                    />
                  </div>
                )}
              </Show>
            </div>
          )
        }}
      </Show>

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
                      <div class={`${styles.message} ${styles.user}`} data-role="user">
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
                        <div class={`${styles.message} ${styles.assistant}`} data-role="assistant">
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

                  {/* AskUserQuestion block */}
                  <Match
                    when={
                      item.kind === 'ask-user-question' &&
                      (item as DisplayItem & { kind: 'ask-user-question' })
                    }
                  >
                    {(i) => {
                      const msg = i().msg
                      const block = getToolUseBlock(msg, 'AskUserQuestion')!
                      const input = block.input as { questions?: AskUserQuestion[] }
                      const questions = input.questions ?? []
                      const result = toolResults().get(block.id)
                      const answers = result ? parseAskUserAnswers(result.content) : new Map<string, string>()
                      return (
                        <div class={`${styles.message} ${styles['ask-user-question']}`} data-role="ask-user-question">
                          <div class={styles.meta}>
                            <span class={styles['role-label']}>Question</span>
                            <A class={styles.uuid} href={`/session/${params.id}/raw?uuid=${msg.uuid}`}>
                              {msg.uuid.slice(0, 8)}
                            </A>
                          </div>
                          <AskUserQuestionView questions={questions} answers={answers} />
                        </div>
                      )
                    }}
                  </Match>

                  {/* ExitPlanMode block */}
                  <Match
                    when={
                      item.kind === 'exit-plan-mode' &&
                      (item as DisplayItem & { kind: 'exit-plan-mode' })
                    }
                  >
                    {(i) => {
                      const msg = i().msg
                      const block = getToolUseBlock(msg, 'ExitPlanMode')!
                      const plan = (block.input as { plan?: string }).plan ?? ''
                      const result = toolResults().get(block.id)
                      const outputKey = `${msg.uuid}-plan-output`
                      return (
                        <div class={`${styles.message} ${styles['exit-plan-mode']}`} data-role="exit-plan-mode">
                          <div class={styles.meta}>
                            <span class={styles['role-label']}>Plan</span>
                            <A class={styles.uuid} href={`/session/${params.id}/raw?uuid=${msg.uuid}`}>
                              {msg.uuid.slice(0, 8)}
                            </A>
                          </div>
                          <div
                            class={`${styles['plan-content']} ${styles.prose}`}
                            innerHTML={marked.parse(plan) as string}
                          />
                          <Show when={result}>
                            {(r) => (
                              <div class={styles['plan-output']}>
                                <button class={styles.toggle} onClick={() => toggle(outputKey)}>
                                  {expanded().has(outputKey) ? '\u25BE' : '\u25B8'} Output
                                  <Show when={r().content.includes('rejected')}>
                                    <span class={styles['error-badge']}>rejected</span>
                                  </Show>
                                  <Show when={!r().content.includes('rejected')}>
                                    <span class={styles['ok-badge']}>accepted</span>
                                  </Show>
                                </button>
                                <Show when={expanded().has(outputKey)}>
                                  <pre class={styles['plan-output-content']}>{r().content}</pre>
                                </Show>
                              </div>
                            )}
                          </Show>
                        </div>
                      )
                    }}
                  </Match>

                  {/* Bash block */}
                  <Match
                    when={
                      item.kind === 'bash' &&
                      (item as DisplayItem & { kind: 'bash' })
                    }
                  >
                    {(i) => {
                      const msg = i().msg
                      const block = getToolUseBlock(msg, 'Bash')!
                      const input = block.input as { command?: string; description?: string }
                      const command = input.command ?? ''
                      const description = input.description ?? ''
                      const result = toolResults().get(block.id)
                      const outputKey = `${msg.uuid}-bash-output`
                      return (
                        <div class={`${styles.message} ${styles.bash}`} data-role="bash">
                          <div class={styles['bash-header']}>
                            <span class={styles['bash-prompt']}>$</span>
                            <span class={styles['bash-desc']}>{description}</span>
                            <Show when={result?.isError}>
                              <span class={styles['error-badge']}>error</span>
                            </Show>
                          </div>
                          <HighlightedBash code={command} />
                          <Show when={result}>
                            {(r) => (
                              <div class={styles['bash-output-section']}>
                                <button class={styles.toggle} onClick={() => toggle(outputKey)}>
                                  {expanded().has(outputKey) ? '\u25BE' : '\u25B8'} Output
                                </button>
                                <Show when={expanded().has(outputKey)}>
                                  <pre
                                    class={styles['bash-output']}
                                    classList={{ [styles['is-error']]: !!r().isError }}
                                  >{stripAnsi(r().content)}</pre>
                                </Show>
                              </div>
                            )}
                          </Show>
                        </div>
                      )
                    }}
                  </Match>

                  {/* Agent/Task block */}
                  <Match
                    when={
                      item.kind === 'agent' &&
                      (item as DisplayItem & { kind: 'agent' })
                    }
                  >
                    {(i) => {
                      const msg = i().msg
                      const block = getAgentBlock(msg)!
                      const input = block.input as {
                        description?: string
                        prompt?: string
                        subagent_type?: string
                      }
                      const description = input.description ?? ''
                      const subagentType = input.subagent_type ?? ''
                      const result = toolResults().get(block.id)
                      const agentId = () => agentMap().get(block.id)
                      const key = `${msg.uuid}-agent`
                      const outputKey = `${msg.uuid}-agent-output`
                      return (
                        <div
                          class={styles['internal-single']}
                          classList={{
                            [styles['tool-block']]: true,
                            [styles['is-expanded']]: expanded().has(key),
                          }}
                          data-role="agent"
                        >
                          <button
                            class={styles['internal-toggle']}
                            onClick={() => toggle(key)}
                          >
                            <span class={styles.caret}>
                              {expanded().has(key) ? '\u25BE' : '\u25B8'}
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
                          <Show when={expanded().has(key)}>
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
                                    <button class={styles.toggle} onClick={() => toggle(outputKey)}>
                                      {expanded().has(outputKey) ? '\u25BE' : '\u25B8'} Output
                                    </button>
                                    <Show when={expanded().has(outputKey)}>
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
                      <div class={styles['internal-group']} data-role="internal-group">
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
                    <div class={`${styles.message} ${styles.system}`} data-role="system">
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
