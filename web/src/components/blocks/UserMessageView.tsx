// User text message rendered as markdown. Top-level DisplayItem kind='user'.

import type { SessionMessage } from '../../lib/types'
import MessageBlock from './MessageBlock'
import Prose from '../Prose'
import styles from '../SessionView.module.css'

export default function UserMessageView(props: {
  msg: SessionMessage
  sessionId: string
}) {
  return (
    <MessageBlock variant="user" role="user" label="User" sessionId={props.sessionId} uuid={props.msg.uuid}>
      <Prose
        text={
          props.msg.userContent?.__typename === 'UserTextContent'
            ? (props.msg.userContent as { text: string }).text
            : ''
        }
        class={`${styles.content} ${styles.prose}`}
      />
    </MessageBlock>
  )
}
