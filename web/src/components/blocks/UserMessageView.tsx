// User text message rendered as markdown. Top-level DisplayItem kind='user'.

import type { SessionMessage } from '../../lib/types'
import MessageBlock from './MessageBlock'
import mb from './MessageBlock.module.css'
import Prose from '../Prose'

export default function UserMessageView(props: {
  msg: SessionMessage
  sessionId: string
}) {
  return (
    <MessageBlock variant="user" role="user" label="User" meta={{ sessionId: props.sessionId, uuid: props.msg.uuid }}>
      <Prose
        text={
          props.msg.userContent?.__typename === 'UserTextContent'
            ? (props.msg.userContent as { text: string }).text
            : ''
        }
        class={mb.content}
      />
    </MessageBlock>
  )
}
