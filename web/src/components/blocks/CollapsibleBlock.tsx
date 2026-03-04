import type { JSX, ParentProps } from 'solid-js'
import { Show } from 'solid-js'
import cb from './CollapsibleBlock.module.css'
import MessageMeta, { type MetaProps } from './MessageMeta'

export default function CollapsibleBlock(props: ParentProps<{
  expanded: boolean
  toggle: () => void
  role: string
  id?: string
  class?: string
  classList?: Record<string, boolean | undefined>
  label: JSX.Element
  meta: MetaProps,
}>) {
  const blockId = () => props.id ?? props.meta.uuid
  return (
    <div id={blockId()} class={props.class} classList={props.classList} data-role={props.role} data-expanded={props.expanded || undefined}>
      <button class={cb['toggle']} onClick={() => props.toggle()}>
        <a class={cb['link-icon']} href={`#${blockId()}`} onClick={(e) => e.stopPropagation()} title="Link to this block">
          &#x1F517;
        </a>
        <span class={cb.caret}>
          {props.expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span class={cb['label']}>
          {props.label}
        </span>
        <MessageMeta {...props.meta} />
      </button>
      <Show when={props.expanded}>
        {props.children}
      </Show>
    </div>
  )
}
