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
    <div id={props.uuid} class={`${styles.message} ${styles[props.variant]}`} data-role={props.role}>
      <div class={styles.meta}>
        <a class={styles['role-label']} href={`#${props.uuid}`}>{props.label}</a>
        {props.extraMeta}
        <span class={styles['meta-right']}>
          {props.rightMeta}
          <A class={styles.uuid} href={`/session/${props.sessionId}/raw#${props.uuid}`}>
            {props.uuid.slice(0, 8)}
          </A>
        </span>
      </div>
      {props.children}
    </div>
  )
}
