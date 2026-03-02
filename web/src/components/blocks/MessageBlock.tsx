import type { JSX, ParentProps } from 'solid-js'
import { A } from '@solidjs/router'
import styles from '../SessionView.module.css'

export default function MessageBlock(props: ParentProps<{
  variant: string
  role: string
  label: string
  sessionId: string
  uuid: string
  extraMeta?: JSX.Element
  rightMeta?: JSX.Element
}>) {
  return (
    <div class={`${styles.message} ${styles[props.variant]}`} data-role={props.role}>
      <div class={styles.meta}>
        <span class={styles['role-label']}>{props.label}</span>
        {props.extraMeta}
        <span class={styles['meta-right']}>
          {props.rightMeta}
          <A class={styles.uuid} href={`/session/${props.sessionId}/raw?uuid=${props.uuid}`}>
            {props.uuid.slice(0, 8)}
          </A>
        </span>
      </div>
      {props.children}
    </div>
  )
}
