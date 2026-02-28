<script lang="ts">
  import { query } from '../lib/graphql';
  import { marked } from 'marked';
  import type { SessionMessage, ContentBlock } from '../lib/types';

  interface Props {
    sessionId: string;
    onBack: () => void;
  }

  let { sessionId, onBack }: Props = $props();

  let messages = $state<SessionMessage[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const SESSION_QUERY = `query ($id: String!) {
    session(id: $id) {
      uuid parentUuid timestamp eventType
      userContent {
        __typename
        ... on UserTextContent { text }
        ... on UserToolResults { results { toolUseId content isError } }
      }
      assistantContent {
        model stopReason
        usage { inputTokens outputTokens cacheCreationInputTokens cacheReadInputTokens }
        blocks {
          __typename
          ... on TextBlock { text }
          ... on ThinkingBlock { thinking }
          ... on ToolUseBlock { id name input }
          ... on ToolResultBlock { toolUseId content isError }
        }
      }
      systemInfo { subtype durationMs }
    }
  }`;

  async function load() {
    try {
      const data = await query<{ session: SessionMessage[] | null }>(SESSION_QUERY, { id: sessionId });
      messages = data.session ?? [];
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  load();

  // Build a map of tool_use_id -> tool result content for pairing
  let toolResults = $derived.by(() => {
    const map = new Map<string, { content: string; isError: boolean | null }>();
    for (const msg of messages) {
      if (msg.userContent?.__typename === 'UserToolResults') {
        for (const r of msg.userContent.results) {
          map.set(r.toolUseId, { content: r.content, isError: r.isError });
        }
      }
    }
    return map;
  });

  function hasUserFacingText(msg: SessionMessage): boolean {
    if (!msg.assistantContent) return false;
    return msg.assistantContent.blocks.some(b => b.__typename === 'TextBlock');
  }

  type DisplayItem =
    | { kind: 'user'; msg: SessionMessage }
    | { kind: 'assistant'; msg: SessionMessage }
    | { kind: 'internal-group'; key: string; steps: string[]; tokens: number; msgs: SessionMessage[] }
    | { kind: 'system'; msg: SessionMessage };

  /** Group consecutive internal assistant messages into single collapsed items */
  let displayItems = $derived.by(() => {
    const items: DisplayItem[] = [];
    let internalAcc: SessionMessage[] = [];

    function flushInternal() {
      if (internalAcc.length === 0) return;
      const steps: string[] = [];
      let tokens = 0;
      const key = `ig-${internalAcc[0].uuid}`;
      for (const m of internalAcc) {
        if (m.assistantContent) {
          for (const b of m.assistantContent.blocks) {
            if (b.__typename === 'ThinkingBlock') steps.push('Thinking');
            else if (b.__typename === 'ToolUseBlock') steps.push(b.name);
          }
          const u = m.assistantContent.usage;
          if (u) tokens += (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
        }
      }
      items.push({ kind: 'internal-group', key, steps, tokens, msgs: internalAcc });
      internalAcc = [];
    }

    for (const m of messages) {
      if (m.eventType === 'USER' && m.userContent?.__typename === 'UserTextContent') {
        flushInternal();
        items.push({ kind: 'user', msg: m });
      } else if (m.eventType === 'ASSISTANT' && m.assistantContent) {
        if (hasUserFacingText(m)) {
          flushInternal();
          items.push({ kind: 'assistant', msg: m });
        } else {
          internalAcc.push(m);
        }
      } else if (m.eventType === 'SYSTEM' && m.systemInfo?.subtype === 'turn_duration') {
        flushInternal();
        items.push({ kind: 'system', msg: m });
      }
    }
    flushInternal();
    return items;
  });

  function formatInput(input: unknown): string {
    if (typeof input === 'string') return input;
    return JSON.stringify(input, null, 2);
  }

  function truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, max) + '...';
  }

  let expanded = $state(new Set<string>());

  function toggle(key: string) {
    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
    }
    expanded = new Set(expanded);
  }

  function totalTokens(msg: SessionMessage): number | null {
    const u = msg.assistantContent?.usage;
    if (!u) return null;
    return (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
  }

  /** Compact summary: deduplicate consecutive same-name steps with counts */
  function compactSteps(steps: string[]): { name: string; count: number }[] {
    const result: { name: string; count: number }[] = [];
    for (const s of steps) {
      const last = result[result.length - 1];
      if (last && last.name === s) {
        last.count++;
      } else {
        result.push({ name: s, count: 1 });
      }
    }
    return result;
  }
</script>

<div class="session-view">
  <header>
    <button onclick={onBack}>&larr; Back</button>
    <h1><a class="session-link" href="#/session/{sessionId}/raw">Session {sessionId.slice(0, 8)}</a></h1>
  </header>

  {#if loading}
    <p class="status">Loading session...</p>
  {:else if error}
    <p class="status error">Error: {error}</p>
  {:else}
    <div class="messages">
      {#each displayItems as item (item.kind === 'internal-group' ? item.key : item.kind === 'system' ? item.msg.uuid : item.msg.uuid)}

        {#if item.kind === 'user'}
          <div class="message user">
            <div class="role-label">User</div>
            <div class="content prose">{@html marked.parse(item.msg.userContent?.__typename === 'UserTextContent' ? item.msg.userContent.text : '')}</div>
          </div>

        {:else if item.kind === 'assistant'}
          <div class="message assistant">
            <div class="meta">
              <span class="role-label">Assistant</span>
              {#if item.msg.assistantContent?.model}
                <span class="model">{item.msg.assistantContent.model}</span>
              {/if}
              {#if totalTokens(item.msg) !== null}
                <span class="tokens">{totalTokens(item.msg)?.toLocaleString()} tokens</span>
              {/if}
            </div>
            <div class="blocks">
              {#each item.msg.assistantContent?.blocks ?? [] as block, i}
                {#if block.__typename === 'TextBlock'}
                  <div class="block text-block prose">
                    {@html marked.parse(block.text)}
                  </div>
                {:else if block.__typename === 'ThinkingBlock'}
                  {@const key = `${item.msg.uuid}-think-${i}`}
                  <div class="block thinking-block">
                    <button class="toggle" onclick={() => toggle(key)}>
                      {expanded.has(key) ? '▾' : '▸'} Thinking
                    </button>
                    {#if expanded.has(key)}
                      <div class="thinking-content prose prose-mono">{@html marked.parse(block.thinking)}</div>
                    {/if}
                  </div>
                {:else if block.__typename === 'ToolUseBlock'}
                  {@const key = `${item.msg.uuid}-tool-${i}`}
                  {@const result = toolResults.get(block.id)}
                  <div class="block tool-block">
                    <button class="toggle" onclick={() => toggle(key)}>
                      {expanded.has(key) ? '▾' : '▸'} {block.name}
                      {#if result?.isError}
                        <span class="error-badge">error</span>
                      {:else if result}
                        <span class="ok-badge">done</span>
                      {/if}
                    </button>
                    {#if expanded.has(key)}
                      <div class="tool-details">
                        <div class="tool-section">
                          <div class="tool-section-label">Input</div>
                          <pre>{formatInput(block.input)}</pre>
                        </div>
                        {#if result}
                          <div class="tool-section">
                            <div class="tool-section-label">Output</div>
                            <pre class:is-error={result.isError}>{truncate(result.content, 5000)}</pre>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          </div>

        {:else if item.kind === 'internal-group' && item.steps.length === 1}
          <!-- Single-block group: render inline without an outer wrapper -->
          {#each item.msgs as msg}
            {#each msg.assistantContent?.blocks ?? [] as block, i}
              {#if block.__typename === 'ThinkingBlock'}
                {@const key = `${msg.uuid}-think-${i}`}
                <div class="internal-single thinking-block" class:is-expanded={expanded.has(key)}>
                  <button class="internal-toggle" onclick={() => toggle(key)}>
                    <span class="caret">{expanded.has(key) ? '▾' : '▸'}</span>
                    <span class="internal-steps"><span class="step">Thinking</span></span>
                    {#if item.tokens > 0}
                      <span class="internal-tokens">{item.tokens.toLocaleString()} tok</span>
                    {/if}
                  </button>
                  {#if expanded.has(key)}
                    <div class="thinking-content prose prose-mono">{@html marked.parse(block.thinking)}</div>
                  {/if}
                </div>
              {:else if block.__typename === 'ToolUseBlock'}
                {@const key = `${msg.uuid}-tool-${i}`}
                {@const result = toolResults.get(block.id)}
                <div class="internal-single tool-block" class:is-expanded={expanded.has(key)}>
                  <button class="internal-toggle" onclick={() => toggle(key)}>
                    <span class="caret">{expanded.has(key) ? '▾' : '▸'}</span>
                    <span class="internal-steps">
                      <span class="step">{block.name}</span>
                      {#if result?.isError}
                        <span class="error-badge">error</span>
                      {:else if result}
                        <span class="ok-badge">done</span>
                      {/if}
                    </span>
                    {#if item.tokens > 0}
                      <span class="internal-tokens">{item.tokens.toLocaleString()} tok</span>
                    {/if}
                  </button>
                  {#if expanded.has(key)}
                    <div class="tool-details">
                      <div class="tool-section">
                        <div class="tool-section-label">Input</div>
                        <pre>{formatInput(block.input)}</pre>
                      </div>
                      {#if result}
                        <div class="tool-section">
                          <div class="tool-section-label">Output</div>
                          <pre class:is-error={result.isError}>{truncate(result.content, 5000)}</pre>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            {/each}
          {/each}

        {:else if item.kind === 'internal-group'}
          <div class="internal-group">
            <button class="internal-toggle" onclick={() => toggle(item.key)}>
              <span class="caret">{expanded.has(item.key) ? '▾' : '▸'}</span>
              <span class="internal-steps">
                {#each compactSteps(item.steps) as step, i}
                  {#if i > 0}<span class="step-dot">&middot;</span>{/if}
                  <span class="step">{step.name}{#if step.count > 1} &times;{step.count}{/if}</span>
                {/each}
              </span>
              {#if item.tokens > 0}
                <span class="internal-tokens">{item.tokens.toLocaleString()} tok</span>
              {/if}
            </button>
            {#if expanded.has(item.key)}
              <div class="internal-expanded">
                {#each item.msgs as msg}
                  {#each msg.assistantContent?.blocks ?? [] as block, i}
                    {#if block.__typename === 'ThinkingBlock'}
                      {@const key = `${msg.uuid}-think-${i}`}
                      <div class="block thinking-block">
                        <button class="toggle" onclick={() => toggle(key)}>
                          {expanded.has(key) ? '▾' : '▸'} Thinking
                        </button>
                        {#if expanded.has(key)}
                          <div class="thinking-content prose prose-mono">{@html marked.parse(block.thinking)}</div>
                        {/if}
                      </div>
                    {:else if block.__typename === 'ToolUseBlock'}
                      {@const key = `${msg.uuid}-tool-${i}`}
                      {@const result = toolResults.get(block.id)}
                      <div class="block tool-block">
                        <button class="toggle" onclick={() => toggle(key)}>
                          {expanded.has(key) ? '▾' : '▸'} {block.name}
                          {#if result?.isError}
                            <span class="error-badge">error</span>
                          {:else if result}
                            <span class="ok-badge">done</span>
                          {/if}
                        </button>
                        {#if expanded.has(key)}
                          <div class="tool-details">
                            <div class="tool-section">
                              <div class="tool-section-label">Input</div>
                              <pre>{formatInput(block.input)}</pre>
                            </div>
                            {#if result}
                              <div class="tool-section">
                                <div class="tool-section-label">Output</div>
                                <pre class:is-error={result.isError}>{truncate(result.content, 5000)}</pre>
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                {/each}
              </div>
            {/if}
          </div>

        {:else if item.kind === 'system' && item.msg.systemInfo?.durationMs}
          <div class="message system">
            Turn completed in {(item.msg.systemInfo.durationMs / 1000).toFixed(1)}s
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .session-view {
    max-width: 960px;
    margin: 0 auto;
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
  }

  .session-link {
    color: inherit;
    text-decoration: none;
  }

  .session-link:hover {
    text-decoration: underline;
    opacity: 0.8;
  }

  header button {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
  }

  .status { opacity: 0.5; }
  .error { color: #e55; }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .message {
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .message.user {
    background: color-mix(in srgb, currentColor 4%, transparent);
    border-left: 3px solid #a08860;
  }

  .message.assistant {
    background: color-mix(in srgb, currentColor 3%, transparent);
    border-left: 3px solid #7a9070;
  }

  .message.system {
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.35;
    padding: 0.2rem;
  }

  /* --- Internal group (single collapsed row for all agent steps) --- */

  .internal-group {
    margin: -0.25rem 0;
  }

  .internal-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0.5rem;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 0.75rem;
    font-family: monospace;
    opacity: 0.35;
    text-align: left;
    border-radius: 4px;
  }

  .internal-toggle:hover {
    opacity: 0.7;
    background: color-mix(in srgb, currentColor 4%, transparent);
    border-color: transparent;
  }

  .caret {
    font-size: 0.65rem;
    width: 0.8em;
    flex-shrink: 0;
  }

  .internal-steps {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .step-dot {
    opacity: 0.5;
  }

  .internal-tokens {
    white-space: nowrap;
    flex-shrink: 0;
  }

  .internal-single {
    margin: -0.25rem 0;
  }

  .internal-single.thinking-block:not(.is-expanded),
  .internal-single.tool-block:not(.is-expanded) {
    background: none;
  }

  .internal-expanded {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.35rem 0 0.35rem 1rem;
  }

  /* --- Shared --- */

  .role-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.5;
    margin-bottom: 0.25rem;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .model {
    font-size: 0.75rem;
    opacity: 0.4;
    font-family: monospace;
  }

  .tokens {
    font-size: 0.75rem;
    opacity: 0.4;
  }

  .content {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .blocks {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .block {
    border-radius: 4px;
  }

  .prose {
    line-height: 1.6;
  }

  .prose :global(p) {
    margin: 0.4em 0;
  }

  .prose :global(p:first-child) {
    margin-top: 0;
  }

  .prose :global(p:last-child) {
    margin-bottom: 0;
  }

  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3) {
    margin: 0.8em 0 0.3em;
    line-height: 1.3;
  }

  .prose :global(h1) { font-size: 1.3em; }
  .prose :global(h2) { font-size: 1.15em; }
  .prose :global(h3) { font-size: 1.05em; }

  .prose :global(ul) {
    margin: 0.4em 0;
    padding-left: 1.8em;
    list-style-position: outside;
  }

  .prose :global(ol) {
    margin: 0.4em 0;
    padding-left: 3em;
    list-style-position: outside;
  }

  .prose :global(li) {
    margin: 0.15em 0;
    text-indent: -0.4em;
    padding-left: 0.4em;
  }

  .prose :global(code) {
    font-family: monospace;
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .prose :global(pre) {
    margin: 0.5em 0;
    padding: 0.6em 0.8em;
    border-radius: 6px;
    background: color-mix(in srgb, currentColor 6%, transparent);
    overflow-x: auto;
    font-size: 0.85em;
    line-height: 1.4;
  }

  .prose :global(pre code) {
    padding: 0;
    background: none;
  }

  .prose :global(blockquote) {
    margin: 0.5em 0;
    padding: 0.2em 0.8em;
    border-left: 3px solid color-mix(in srgb, currentColor 20%, transparent);
    opacity: 0.8;
  }

  .prose :global(strong) {
    font-weight: 600;
  }

  .prose :global(a) {
    color: #a08860;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .thinking-block {
    background: color-mix(in srgb, currentColor 3%, transparent);
    border-radius: 4px;
  }

  .thinking-content {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    opacity: 0.6;
    max-height: 400px;
    overflow-y: auto;
  }

  .prose-mono {
    font-family: monospace;
  }

  .prose-mono :global(pre),
  .prose-mono :global(code) {
    font-family: inherit;
  }

  .tool-block {
    background: color-mix(in srgb, currentColor 3%, transparent);
    border-radius: 4px;
  }

  .toggle {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0.4rem 0.5rem;
    font-size: 0.85rem;
    width: 100%;
    text-align: left;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toggle:hover {
    background: color-mix(in srgb, currentColor 5%, transparent);
    border-color: transparent;
  }

  .error-badge {
    font-size: 0.7rem;
    background: #e55;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .ok-badge {
    font-size: 0.7rem;
    background: #4a4;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .tool-details {
    padding: 0 0.5rem 0.5rem;
  }

  .tool-section {
    margin-top: 0.5rem;
  }

  .tool-section-label {
    font-size: 0.7rem;
    opacity: 0.5;
    text-transform: uppercase;
    margin-bottom: 0.2rem;
  }

  .tool-details pre {
    margin: 0;
    padding: 0.5rem;
    background: color-mix(in srgb, currentColor 6%, transparent);
    border-radius: 4px;
    font-size: 0.8rem;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .is-error {
    color: #e88;
  }
</style>
