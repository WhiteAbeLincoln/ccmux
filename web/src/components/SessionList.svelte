<script lang="ts">
  import { query } from '../lib/graphql';
  import type { Session } from '../lib/types';

  interface Props {
    onSelect: (id: string) => void;
  }

  let { onSelect }: Props = $props();

  let sessions = $state<Session[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const SESSIONS_QUERY = `{
    sessions {
      id project slug createdAt updatedAt messageCount firstMessage projectPath
    }
  }`;

  async function load() {
    try {
      const data = await query<{ sessions: Session[] }>(SESSIONS_QUERY);
      sessions = data.sessions;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  load();

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString();
  }

  interface ProjectGroup {
    project: string;
    displayName: string;
    sessions: Session[];
  }

  let groups = $derived.by(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      let list = map.get(s.project);
      if (!list) {
        list = [];
        map.set(s.project, list);
      }
      list.push(s);
    }
    const result: ProjectGroup[] = [];
    for (const [project, sessions] of map) {
      const displayName = sessions[0]?.projectPath ?? project;
      result.push({ project, displayName, sessions });
    }
    // Sort groups by most recent session update
    result.sort((a, b) => {
      const aMax = a.sessions[0]?.updatedAt ?? '';
      const bMax = b.sessions[0]?.updatedAt ?? '';
      return bMax.localeCompare(aMax);
    });
    return result;
  });

  let collapsed = $state(new Set<string>());

  function toggleGroup(project: string) {
    if (collapsed.has(project)) {
      collapsed.delete(project);
    } else {
      collapsed.add(project);
    }
    collapsed = new Set(collapsed);
  }
</script>

<div class="session-list">
  <h1>Sessions</h1>

  {#if loading}
    <p class="status">Loading sessions...</p>
  {:else if error}
    <p class="status error">Error: {error}</p>
  {:else if sessions.length === 0}
    <p class="status">No sessions found.</p>
  {:else}
    {#each groups as group}
      <div class="project-group">
        <button class="group-header" onclick={() => toggleGroup(group.project)}>
          <span class="caret">{collapsed.has(group.project) ? '▸' : '▾'}</span>
          {#if group.displayName.startsWith('/')}
            <a class="group-name" href="file://{group.displayName}" onclick={(e: MouseEvent) => e.stopPropagation()}>{group.displayName}</a>
          {:else}
            <span class="group-name">{group.displayName}</span>
          {/if}
          <span class="group-count">{group.sessions.length}</span>
        </button>
        {#if !collapsed.has(group.project)}
          <table>
            <thead>
              <tr>
                <th class="th-summary">Summary</th>
                <th class="th-msgs">Msgs</th>
                <th class="th-date">Updated</th>
              </tr>
            </thead>
            <tbody>
              {#each group.sessions as session}
                <tr class="session-row" onclick={() => onSelect(session.id)}>
                  <td class="summary">{session.firstMessage ?? session.slug ?? '—'}</td>
                  <td class="count">{session.messageCount}</td>
                  <td class="date">{formatDate(session.updatedAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .session-list {
    max-width: 960px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .status {
    color: color-mix(in srgb, currentColor 50%, transparent);
  }

  .error {
    color: #e55;
  }

  .project-group {
    margin-bottom: 0.5rem;
  }

  .group-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem;
    background: color-mix(in srgb, currentColor 4%, transparent);
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font-size: 0.9rem;
  }

  .group-header:hover {
    background: color-mix(in srgb, currentColor 8%, transparent);
    border-color: color-mix(in srgb, currentColor 25%, transparent);
  }

  .caret {
    font-size: 0.75rem;
    width: 1em;
  }

  .group-name {
    font-family: monospace;
    font-size: 0.85rem;
    flex: 1;
    color: inherit;
    text-decoration: none;
  }

  a.group-name:hover {
    text-decoration: underline;
    opacity: 0.8;
  }

  .group-count {
    font-size: 0.75rem;
    opacity: 0.5;
    background: color-mix(in srgb, currentColor 8%, transparent);
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-variant-numeric: tabular-nums;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-left: 1rem;
    width: calc(100% - 1rem);
  }

  th {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    font-size: 0.75rem;
    opacity: 0.45;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .session-row {
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .session-row:hover {
    background-color: color-mix(in srgb, currentColor 6%, transparent);
  }

  td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
  }

  .th-summary {
    width: 100%;
  }

  .th-msgs, .th-date {
    white-space: nowrap;
  }

  .summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 0;
    width: 100%;
  }

  .count {
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .date {
    font-size: 0.85rem;
    opacity: 0.55;
    white-space: nowrap;
  }
</style>
