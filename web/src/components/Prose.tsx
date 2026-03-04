import { createEffect } from 'solid-js'
import { marked } from 'marked'
import { highlight } from '../lib/highlight'
import type { BundledLanguage } from 'shiki'
import ps from './Prose.module.css'

export default function Prose(props: {
  text: string
  class?: string
  classList?: Record<string, boolean | undefined>
}) {
  let ref!: HTMLDivElement

  createEffect(() => {
    const html = marked.parse(props.text) as string
    ref.innerHTML = html

    const codeBlocks = ref.querySelectorAll('pre code[class*="language-"]')
    for (const block of codeBlocks) {
      const langMatch = block.className.match(/language-(\S+)/)
      if (!langMatch) continue
      const lang = langMatch[1] as BundledLanguage
      const code = block.textContent || ''
      const pre = block.parentElement!
      highlight(code, lang).then((highlighted) => {
        pre.outerHTML = highlighted
      }).catch(() => {})
    }
  })

  return <div ref={ref} class={`${ps.prose}${props.class ? ` ${props.class}` : ''}`} classList={props.classList} />
}
