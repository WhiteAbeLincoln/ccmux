import { A } from '@solidjs/router'
import type { SessionMessage } from '../../lib/types'
import { getToolUseBlock } from '../../lib/session'
import AskUserQuestionView, { type AskUserQuestion, parseAskUserAnswers } from './AskUserQuestionView'
import styles from '../SessionView.module.css'

export default function AskQuestionBlockView(props: {
  msg: SessionMessage
  sessionId: string
  toolResults: Map<string, { content: string; isError: boolean | null }>
}) {
  const block = getToolUseBlock(props.msg, 'AskUserQuestion')!
  const input = block.input as { questions?: AskUserQuestion[] }
  const questions = input.questions ?? []
  const result = props.toolResults.get(block.id)
  const answers = result ? parseAskUserAnswers(result.content) : new Map<string, string>()
  return (
    <div class={`${styles.message} ${styles['ask-user-question']}`} data-role="ask-user-question">
      <div class={styles.meta}>
        <span class={styles['role-label']}>Question</span>
        <A class={styles.uuid} href={`/session/${props.sessionId}/raw?uuid=${props.msg.uuid}`}>
          {props.msg.uuid.slice(0, 8)}
        </A>
      </div>
      <AskUserQuestionView questions={questions} answers={answers} />
    </div>
  )
}
