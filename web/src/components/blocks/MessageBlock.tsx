import type { JSX, ParentProps } from 'solid-js'
import mb from './MessageBlock.module.css'
import MessageMeta, { type MetaProps } from './MessageMeta'

export default function MessageBlock(props: ParentProps<{
  variant: string
  role: string
  label: string
  meta: MetaProps,
  extraMeta?: JSX.Element
}>) {
  return (
    <div id={props.meta.uuid} class={`${mb.message} ${mb[props.variant]}`} data-role={props.role}>
      <div class={mb.meta}>
        <a class={mb['role-label']} href={`#${props.meta.uuid}`}>{props.label}</a>
        {props.extraMeta}
        <MessageMeta {...props.meta} />
      </div>
      {props.children}
    </div>
  )
}
