// TaskCreate/TaskUpdate tool calls rendered as a collapsible checkbox list.
// Top-level DisplayItem kind='task-list'.

import { For } from 'solid-js'
import CollapsibleBlock from './CollapsibleBlock'
import styles from '../SessionView.module.css'

export default function TaskListView(props: {
  tasks: Map<string, { subject: string; status: string }>
  sessionId: string
  uuid: string
  expanded: boolean
  toggle: () => void
}) {
  const tasks = () => {
    const entries = [...props.tasks.entries()]
    entries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    return entries
  }
  const completed = () =>
    tasks().filter(([, t]) => t.status === 'completed').length

  return (
    <CollapsibleBlock
      role="task-list"
      sessionId={props.sessionId}
      uuid={props.uuid}
      class={styles['task-list']}
      classList={{}}
      expanded={props.expanded}
      toggle={props.toggle}
      label={
        <span class={styles.step}>
          Tasks ({completed()}/{tasks().length} completed)
        </span>
      }
    >
      <div class={styles['task-items']}>
        <For each={tasks()}>
          {([, task]) => (
            <div
              class={styles['task-item']}
              classList={{
                [styles['task-completed']]: task.status === 'completed',
                [styles['task-deleted']]: task.status === 'deleted',
              }}
            >
              <span class={styles['task-checkbox']}>
                {task.status === 'completed'
                  ? '\u2611'
                  : task.status === 'in_progress'
                    ? '\u25D1'
                    : task.status === 'deleted'
                      ? '\u2612'
                      : '\u2610'}
              </span>
              <span class={styles['task-subject']}>{task.subject}</span>
            </div>
          )}
        </For>
      </div>
    </CollapsibleBlock>
  )
}
