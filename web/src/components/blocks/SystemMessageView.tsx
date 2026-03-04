// Turn duration marker shown between assistant turns. Top-level DisplayItem kind='system'.

import type { SessionMessage } from '../../lib/types'
import mb from './MessageBlock.module.css'

export default function SystemMessageView(props: {
  msg: SessionMessage
}) {
  return (
    <div class={`${mb.message} ${mb.system}`} data-role="system">
      Turn completed in{' '}
      {(props.msg.systemInfo!.durationMs! / 1000).toFixed(1)}s
    </div>
  )
}
