import { For, Show } from 'solid-js'
import styles from '../SessionView.module.css'

export default function TaskListView(props: {
  tasks: Map<string, { subject: string; status: string }>
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
    <div
      class={styles['task-list']}
      classList={{ [styles['is-expanded']]: props.expanded }}
      data-role="task-list"
    >
      <button
        class={styles['internal-toggle']}
        onClick={() => props.toggle()}
      >
        <span class={styles.caret}>
          {props.expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span class={styles['internal-steps']}>
          <span class={styles.step}>
            Tasks ({completed()}/{tasks().length} completed)
          </span>
        </span>
      </button>
      <Show when={props.expanded}>
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
      </Show>
    </div>
  )
}
