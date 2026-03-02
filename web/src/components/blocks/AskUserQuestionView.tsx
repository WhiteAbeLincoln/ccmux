import { For } from 'solid-js'
import styles from '../SessionView.module.css'

export interface AskUserQuestion {
  question: string
  header: string
  options: { label: string; description: string }[]
  multiSelect: boolean
}

export function parseAskUserAnswers(resultContent: string): Map<string, string> {
  const answers = new Map<string, string>()
  const regex = /"([^"]+)"="([^"]+)"/g
  let match
  while ((match = regex.exec(resultContent)) !== null) {
    answers.set(match[1], match[2])
  }
  return answers
}

export default function AskUserQuestionView(props: {
  questions: AskUserQuestion[]
  answers: Map<string, string>
}) {
  return (
    <div class={styles['ask-questions']} data-component="ask-user-question">
      <For each={props.questions}>
        {(q) => {
          const answer = () => props.answers.get(q.question)
          return (
            <div
              class={styles['question-group']}
              data-question={q.header}
              itemscope
              itemtype="https://schema.org/Question"
            >
              <div class={styles['question-header']}>
                <span class={styles['question-badge']} itemprop="name">{q.header}</span>
                {q.multiSelect && <span class={styles['multi-badge']}>multi</span>}
              </div>
              <div class={styles['question-text']} itemprop="text">{q.question}</div>
              <div class={styles['question-options']}>
                <For each={q.options}>
                  {(opt) => {
                    const selected = () => answer() === opt.label
                    return (
                      <div
                        class={styles['question-option']}
                        classList={{ [styles['option-selected']]: selected() }}
                        data-selected={selected() ? 'true' : undefined}
                        itemscope
                        itemtype="https://schema.org/Answer"
                        itemprop={selected() ? 'acceptedAnswer' : 'suggestedAnswer'}
                      >
                        <span class={styles['option-indicator']}>
                          {selected() ? '\u25CF' : '\u25CB'}
                        </span>
                        <div>
                          <span class={styles['option-label']} itemprop="text">{opt.label}</span>
                          <span class={styles['option-desc']} itemprop="description">{opt.description}</span>
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
