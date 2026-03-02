// User text message rendered as markdown. Top-level DisplayItem kind='user'.

import { marked } from 'marked'
import type { SessionMessage } from '../../lib/types'
import MessageBlock from './MessageBlock'
import styles from '../SessionView.module.css'

export default function UserMessageView(props: {
  msg: SessionMessage
  sessionId: string
}) {
  return (
    <MessageBlock variant="user" role="user" label="User" sessionId={props.sessionId} uuid={props.msg.uuid}>
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
    </MessageBlock>
  )
}
