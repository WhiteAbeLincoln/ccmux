<script lang="ts">
  import { query } from '../lib/graphql';
  import type { Session } from '../lib/types';

  interface Props {
    sessionId: string;
    onBack: () => void;
  }

  let { sessionId, onBack }: Props = $props();

  let rawContent = $state<string | null>(null);
  let filePath = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let highlightedHtml = $state<string>('');

  const RAW_LOG_QUERY = `query ($id: String!) {
    sessionRawLog(id: $id)
  }`;

  const SESSION_INFO_QUERY = `query ($id: String!) {
    sessionInfo(id: $id) { id filePath }
  }`;

  async function load() {
    try {
      const [rawData, infoData] = await Promise.all([
        query<{ sessionRawLog: string | null }>(RAW_LOG_QUERY, { id: sessionId }),
        query<{ sessionInfo: Session | null }>(SESSION_INFO_QUERY, { id: sessionId }),
      ]);
      rawContent = rawData.sessionRawLog;
      filePath = infoData.sessionInfo?.filePath ?? null;

      if (rawContent) {
        await highlightContent(rawContent);
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function highlightContent(content: string) {
    const { createHighlighter } = await import('shiki');
    const highlighter = await createHighlighter({
      langs: ['jsonl'],
      themes: ['vitesse-dark', 'vitesse-light'],
    });

    highlightedHtml = highlighter.codeToHtml(content, {
      lang: 'jsonl',
      themes: { dark: 'vitesse-dark', light: 'vitesse-light' },
    });
  }

  function download() {
    if (!rawContent) return;
    const blob = new Blob([rawContent], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionId}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  load();
</script>

<div class="raw-log-view">
  <header>
    <button onclick={onBack}>&larr; Back</button>
    <h1>Raw Log &mdash; {sessionId.slice(0, 8)}</h1>
    {#if rawContent}
      <button class="download-btn" onclick={download}>Download</button>
    {/if}
  </header>

  {#if filePath}
    <div class="file-path">{filePath}</div>
  {/if}

  {#if loading}
    <p class="status">Loading...</p>
  {:else if error}
    <p class="status error">Error: {error}</p>
  {:else if !rawContent}
    <p class="status">Empty log file.</p>
  {:else}
    <div class="highlighted-json">{@html highlightedHtml}</div>
  {/if}
</div>

<style>
  .raw-log-view {
    max-width: none;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  header h1 {
    font-size: 1.2rem;
    font-family: monospace;
    flex: 1;
  }

  header button {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
  }

  .download-btn {
    white-space: nowrap;
  }

  .file-path {
    font-family: monospace;
    font-size: 0.8rem;
    opacity: 0.5;
    margin-bottom: 1rem;
    word-break: break-all;
  }

  .status { opacity: 0.5; }
  .error { color: #e55; }

  .highlighted-json {
    overflow-x: auto;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .highlighted-json :global(pre) {
    margin: 0;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: color-mix(in srgb, currentColor 3%, transparent) !important;
  }

  .highlighted-json :global(code) {
    font-family: monospace;
  }
</style>
