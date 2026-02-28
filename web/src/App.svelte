<script lang="ts">
  import SessionList from './components/SessionList.svelte';
  import SessionView from './components/SessionView.svelte';
  import RawLogView from './components/RawLogView.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';

  type Route =
    | { view: 'list' }
    | { view: 'session'; id: string }
    | { view: 'raw'; id: string };

  let route = $state<Route>({ view: 'list' });

  function readHash(): Route {
    const hash = window.location.hash;
    const rawMatch = hash.match(/^#\/session\/([^/]+)\/raw$/);
    if (rawMatch) return { view: 'raw', id: rawMatch[1] };
    const sessionMatch = hash.match(/^#\/session\/([^/]+)$/);
    if (sessionMatch) return { view: 'session', id: sessionMatch[1] };
    return { view: 'list' };
  }

  route = readHash();

  $effect(() => {
    function onHashChange() {
      route = readHash();
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  function selectSession(id: string) {
    window.location.hash = `#/session/${id}`;
  }

  function goBack() {
    window.location.hash = '';
  }

  function goBackToSession(id: string) {
    window.location.hash = `#/session/${id}`;
  }
</script>

<nav>
  <ThemeToggle />
</nav>

<main>
  {#if route.view === 'raw'}
    <RawLogView sessionId={route.id} onBack={() => goBackToSession(route.view === 'raw' ? route.id : '')} />
  {:else if route.view === 'session'}
    <SessionView sessionId={route.id} onBack={goBack} />
  {:else}
    <SessionList onSelect={selectSession} />
  {/if}
</main>

<style>
  nav {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }
</style>
