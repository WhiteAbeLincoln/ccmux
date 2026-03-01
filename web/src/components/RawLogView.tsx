import { createResource, Show, Switch, Match } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { query } from '../lib/graphql'
import type { Session } from '../lib/types'
import styles from './RawLogView.module.css'

const RAW_LOG_QUERY = `query ($id: String!) {
  sessionRawLog(id: $id)
}`

const SESSION_INFO_QUERY = `query ($id: String!) {
  sessionInfo(id: $id) { id filePath }
}`

export default function RawLogView() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data] = createResource(
    () => params.id,
    async (id) => {
      const [rawData, infoData] = await Promise.all([
        query<{ sessionRawLog: string | null }>(RAW_LOG_QUERY, { id }),
        query<{ sessionInfo: Session | null }>(SESSION_INFO_QUERY, { id }),
      ])

      const rawContent = rawData.sessionRawLog
      const filePath = infoData.sessionInfo?.filePath ?? null
      let highlightedHtml = ''

      if (rawContent) {
        const { createHighlighter } = await import('shiki')
        const highlighter = await createHighlighter({
          langs: ['jsonl'],
          themes: ['vitesse-dark', 'vitesse-light'],
        })
        highlightedHtml = highlighter.codeToHtml(rawContent, {
          lang: 'jsonl',
          themes: { dark: 'vitesse-dark', light: 'vitesse-light' },
        })
      }

      return { rawContent, filePath, highlightedHtml }
    },
  )

  function download() {
    const content = data()?.rawContent
    if (!content) return
    const blob = new Blob([content], { type: 'application/jsonl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${params.id}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div class={styles['raw-log-view']}>
      <header>
        <button onClick={() => navigate(`/session/${params.id}`)}>&larr; Back</button>
        <h1>Raw Log &mdash; {params.id.slice(0, 8)}</h1>
        <Show when={data()?.rawContent}>
          <button class={styles['download-btn']} onClick={download}>
            Download
          </button>
        </Show>
      </header>

      <Show when={data()?.filePath}>
        {(fp) => <div class={styles['file-path']}>{fp()}</div>}
      </Show>

      <Switch>
        <Match when={data.loading}>
          <p class={styles.status}>Loading...</p>
        </Match>
        <Match when={data.error}>
          <p class={`${styles.status} ${styles.error}`}>
            Error: {(data.error as Error).message}
          </p>
        </Match>
        <Match when={!data()?.rawContent}>
          <p class={styles.status}>Empty log file.</p>
        </Match>
        <Match when={data()?.highlightedHtml}>
          {(html) => <div class={styles['highlighted-json']} innerHTML={html()} />}
        </Match>
      </Switch>
    </div>
  )
}
