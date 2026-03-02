import { createResource, Show } from 'solid-js'
import { createHighlighter, type Highlighter } from 'shiki'
import styles from '../SessionView.module.css'

let _highlighter: Promise<Highlighter> | null = null
function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = createHighlighter({
      themes: ['vitesse-dark', 'vitesse-light'],
      langs: ['bash'],
    })
  }
  return _highlighter
}

export default function HighlightedBash(props: { code: string }) {
  const [html] = createResource(
    () => props.code,
    async (code) => {
      const hl = await getHighlighter()
      return hl.codeToHtml(code, {
        lang: 'bash',
        themes: { dark: 'vitesse-dark', light: 'vitesse-light' },
        defaultColor: false,
      })
    },
  )
  return (
    <Show when={html()} fallback={<pre class={styles['bash-command']}><code>{props.code}</code></pre>}>
      {(h) => <div class={styles['bash-command']} innerHTML={h()} />}
    </Show>
  )
}
