import {
  type JSX,
  createMemo,
  createSignal,
  useContext,
  Switch,
  Match,
  For,
  Show,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type {
  DisplayItemWithMode,
  DisplayItem,
} from '../../lib/display-item'
import { JsonTree } from '../../lib/json-tree'
import { upperFirst } from '../../lib/util'
import { SessionContext } from '../session-context'
import { ToolBlockContext } from './tool-block-context'
import Prose from '../Prose'
import MessageBlock from './MessageBlock'
import ToolUseBlockView, { toolExtraLabel } from './ToolUseBlockView'
import mb from './MessageBlock.module.css'
import tb from './ThinkingBlockView.module.css'
import rer from '../RawEventRow.module.css'
import tl from './TaskListView.module.css'
import RawEventRow from '../RawEventRow'

export function DisplayItemView(props: {
  event: DisplayItemWithMode
  idx: number
}): JSX.Element {
  const displayEvents = createMemo(() => {
    const e = props.event
    if (e.mode === 'grouped' || e.mode === 'task-list') return e.items
    return [e.item]
  })
  const ctx = useContext(SessionContext)
  return (
    <Switch>
      <Match when={ctx.globalRaw()}>
        <For each={displayEvents()}>
          {(evt) => <RawDisplayItem event={evt} />}
        </For>
      </Match>
      <Match when={props.event.mode === 'hidden'}>{null}</Match>
      <Match
        when={
          props.event.mode === 'task-list'
            ? (props.event as Extract<DisplayItemWithMode, { mode: 'task-list' }>)
            : undefined
        }
      >
        {(e) => <TaskListGroup events={e().items} />}
      </Match>
      <Match
        when={
          props.event.mode === 'grouped' && props.event.items.length > 1
            ? props.event
            : undefined
        }
      >
        {(e) => (
          <GroupedEvent events={e().items} />
        )}
      </Match>
      <Match when={true}>
        <RenderDisplayItem
          event={props.event as SingleItemMode}
        />
      </Match>
    </Switch>
  )
}

function TaskListGroup(props: { events: DisplayItem[] }) {
  const ctx = useContext(SessionContext)
  const id = () => {
    const first = props.events[0]
    const last = props.events[props.events.length - 1]
    return `group-${first.id}-${last.id}`
  }

  type Task = { subject: string; status: string }

  // Build a global task description lookup from all TaskCreate events in the session
  const taskDescriptions = createMemo(() => {
    const descs = new Map<string, string>()
    for (const [, toolUse] of ctx.toolUseMap?.() ?? []) {
      if (toolUse.content.name !== 'TaskCreate') continue
      const input = toolUse.content.input as Record<string, unknown> | undefined
      if (!input) continue
      // Get task number from tool result: "Task #1 created successfully"
      const result = ctx.getToolResult(toolUse.content.id)
      const resultText =
        typeof result?.content?.content === 'string'
          ? result.content.content
          : ''
      const numMatch = resultText.match(/#(\d+)/)
      if (numMatch) {
        descs.set(
          numMatch[1],
          (input.description ?? input.subject ?? '') as string,
        )
      }
    }
    return descs
  })

  const tasks = createMemo(() => {
    const taskMap = new Map<string, Task>()
    let createCounter = 0

    for (const evt of props.events) {
      if (evt.kind !== 'tool-use') continue
      const input = evt.content.input as Record<string, unknown> | undefined
      if (!input) continue

      if (evt.content.name === 'TaskCreate') {
        // Get task number from tool result
        const result = ctx.getToolResult(evt.content.id)
        const resultText =
          typeof result?.content?.content === 'string'
            ? result.content.content
            : ''
        const numMatch = resultText.match(/#(\d+)/)
        createCounter++
        const taskId = numMatch ? numMatch[1] : String(createCounter)

        taskMap.set(taskId, {
          subject:
            ((input.description ?? input.subject ?? '') as string) ||
            `Task ${taskId}`,
          status: 'pending',
        })
      } else if (evt.content.name === 'TaskUpdate') {
        const taskId = (input.task_id ?? input.taskId ?? '') as string
        const status = (input.status ?? '') as string
        if (taskId && status) {
          const existing = taskMap.get(taskId)
          if (existing) {
            existing.status = status
          } else {
            // Look up description from global TaskCreate events
            const desc = taskDescriptions().get(taskId)
            taskMap.set(taskId, {
              subject: desc || `Task ${taskId}`,
              status,
            })
          }
        }
      }
    }
    const entries = [...taskMap.entries()]
    entries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    return entries
  })

  const completed = () =>
    tasks().filter(([, t]) => t.status === 'completed').length

  const isRaw = () => ctx.displayAsRaw(id())

  return (
    <>
      <MessageBlock
        kind="collapsed"
        id={id()}
        expanded={ctx.isExpanded(id())}
        onExpand={() => ctx.toggleExpanded(id())}
        label={
          <>Tasks ({completed()}/{tasks().length} completed)</>
        }
        class={tl['task-list']}
        isRaw={isRaw()}
        onToggleRaw={() => ctx.toggleRawDisplay(id())}
      >
        <div class={tl['task-items']}>
          <For each={tasks()}>
            {([, task]) => (
              <div
                class={tl['task-item']}
                classList={{
                  [tl['task-completed']]: task.status === 'completed',
                  [tl['task-deleted']]: task.status === 'deleted',
                }}
              >
                <span class={tl['task-checkbox']}>
                  {task.status === 'completed'
                    ? '\u2611'
                    : task.status === 'in_progress'
                      ? '\u25D1'
                      : task.status === 'deleted'
                        ? '\u2612'
                        : '\u2610'}
                </span>
                <span>{task.subject}</span>
              </div>
            )}
          </For>
        </div>
      </MessageBlock>
      <Show when={isRaw()}>
        <div class={rer['raw-inline']}>
          <For each={props.events}>
            {(evt) => <JsonTree value={evt.event} defaultExpandDepth={1} />}
          </For>
        </div>
      </Show>
    </>
  )
}

function GroupedEvent(props: { events: DisplayItem[] }) {
  const ctx = useContext(SessionContext)
  const id = () => {
    const first = props.events[0]
    const last = props.events[props.events.length - 1]
    return `group-${first.id}-${last.id}`
  }

  const steps = createMemo(() => {
    const stepMap = new Map<string, number>()

    for (const evt of props.events) {
      const name = evtToName(evt)
      stepMap.set(name, (stepMap.get(name) ?? 0) + 1)
    }
    return [...stepMap.entries()]
  })

  return (
    <MessageBlock
      kind="grouped"
      id={id()}
      expanded={ctx.isExpanded(id())}
      onExpand={() => ctx.toggleExpanded(id())}
      steps={steps()}
      label={null}
    >
      <For each={props.events}>
        {(evt) => (
          <RenderDisplayItem event={{ item: evt, mode: 'collapsed' }} />
        )}
      </For>
    </MessageBlock>
  )
}

type SingleItemMode = Exclude<
  DisplayItemWithMode,
  { mode: 'hidden' | 'task-list' }
>

function RenderDisplayItem(props: { event: SingleItemMode }) {
  // we already handle the case where a grouped event has multiple items, so if it's grouped it must have exactly 1 item
  const displayItem = () =>
    props.event.mode === 'grouped' ? props.event.items[0] : props.event.item
  const id = () => displayItem().id
  const rawItem = () => displayItem().event
  const displayMode = () =>
    props.event.mode === 'grouped' ? 'collapsed' : props.event.mode
  const ctx = useContext(SessionContext)

  const computedLabel = createMemo(() => toolExtraLabel(displayItem()))
  const [childLabel, setExtraLabel] = createSignal<JSX.Element | undefined>(
    undefined,
  )
  const effectiveExtraLabel = () => {
    const cl = childLabel()
    return cl !== undefined ? cl : computedLabel()
  }

  return (
    <>
      {/* special case for turn duration which we don't want to wrap */}
      <Show
        when={
          !(displayItem().kind == 'turn-duration' && displayMode() === 'full')
        }
        fallback={<TurnDuration event={displayItem() as any} />}
      >
        {(_) => (
          <ToolBlockContext.Provider value={{ setExtraLabel }}>
            <MessageBlock
              kind={displayMode()}
              label={evtToName(displayItem())}
              extraLabel={effectiveExtraLabel()}
              expanded={ctx.isExpanded(id())}
              onExpand={() => ctx.toggleExpanded(id())}
              id={displayItem().id}
              event={displayItem()}
              isRaw={ctx.displayAsRaw(id())}
              onToggleRaw={() => ctx.toggleRawDisplay(id())}
            >
              <Dynamic
                component={eventRenderMap[displayItem().kind]}
                event={displayItem() as any}
              />
            </MessageBlock>
          </ToolBlockContext.Provider>
        )}
      </Show>
      <Show when={ctx.displayAsRaw(id())}>
        <div class={rer['raw-inline']}>
          <Show when={displayItem().kind === 'tool-use'}>
            <div class={rer['raw-inline-label']}>tool_use</div>
          </Show>
          <JsonTree value={rawItem()} defaultExpandDepth={1} />
          <Show
            when={(() => {
              const item = displayItem()
              return item.kind === 'tool-use'
                ? ctx.getToolResult(item.content.id)
                : undefined
            })()}
          >
            {(result) => (
              <>
                <div class={rer['raw-inline-label']}>tool_result</div>
                <JsonTree value={result().event} defaultExpandDepth={1} />
              </>
            )}
          </Show>
        </div>
      </Show>
    </>
  )
}

function TurnDuration(props: {
  event: Extract<DisplayItem, { kind: 'turn-duration' }>
}) {
  return (
    <div class={`${mb.message} ${mb.system}`} data-role="system">
      Turn completed in {(props.event.event.durationMs! / 1000).toFixed(1)}s
    </div>
  )
}

type EventRenderMap = {
  [k in DisplayItem['kind']]: (props: {
    event: Extract<DisplayItem, { kind: k }>
  }) => JSX.Element
}

const eventRenderMap: EventRenderMap = {
  'user-message': (props) => <Prose text={props.event.content} />,
  'assistant-message': (props) => <Prose text={props.event.content.text} />,
  compaction: (props) => <Prose text={props.event.content} />,
  thinking: (props) => (
    <Prose
      text={props.event.content.thinking}
      class={`${tb['thinking-content']} ${tb['prose-mono']}`}
    />
  ),
  'tool-use': ToolUseBlockView,
  'tool-result': ToolUseBlockView,
  'turn-duration': TurnDuration,
  other: RawDisplayItem,
}

function evtToName(evt: DisplayItem): string {
  switch (evt.kind) {
    case 'user-message':
      return 'User'
    case 'compaction':
      return 'Compaction'
    case 'thinking':
      return 'Thinking'
    case 'tool-result':
      return 'Tool Result'
    case 'tool-use':
      return evt.content.name
    case 'assistant-message':
      return 'Assistant'
    case 'turn-duration':
      return 'Turn Duration'
    case 'other':
      const sub = evt.event.subtype ? ` (${evt.event.subtype})` : ''
      return `${upperFirst(evt.event.type)} Event${sub}`
  }
}

function RawDisplayItem(props: { event: DisplayItem }) {
  const ctx = useContext(SessionContext)

  return (
    <RawEventRow
      event={props.event.event}
      expanded={ctx.isExpanded(props.event.id)}
      onToggle={() => ctx.toggleExpanded(props.event.id)}
    />
  )
}
