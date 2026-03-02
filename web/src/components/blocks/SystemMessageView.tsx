// Turn duration marker shown between assistant turns. Top-level DisplayItem kind='system'.

import type { SessionMessage } from '../../lib/types'
import styles from '../SessionView.module.css'

export default function SystemMessageView(props: {
  msg: SessionMessage
}) {
  return (
    <div class={`${styles.message} ${styles.system}`} data-role="system">
      Turn completed in{' '}
      {(props.msg.systemInfo!.durationMs! / 1000).toFixed(1)}s
    </div>
  )
}
