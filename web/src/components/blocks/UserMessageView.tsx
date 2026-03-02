import { A } from '@solidjs/router'
import { marked } from 'marked'
import type { SessionMessage } from '../../lib/types'
import styles from '../SessionView.module.css'

export default function UserMessageView(props: {
  msg: SessionMessage
  sessionId: string
}) {
  return (
    <div class={`${styles.message} ${styles.user}`} data-role="user">
      <div class={styles.meta}>
        <span class={styles['role-label']}>User</span>
        <A class={styles.uuid} href={`/session/${props.sessionId}/raw?uuid=${props.msg.uuid}`}>
          {props.msg.uuid.slice(0, 8)}
        </A>
      </div>
      <div
        class={`${styles.content} ${styles.prose}`}
        innerHTML={
          marked.parse(
            props.msg.userContent?.__typename === 'UserTextContent'
              ? (props.msg.userContent as { text: string }).text
              : '',
          ) as string
        }
      />
    </div>
  )
}
