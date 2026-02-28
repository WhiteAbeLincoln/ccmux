<script lang="ts">
  type Mode = 'system' | 'light' | 'dark';

  let mode = $state<Mode>((localStorage.getItem('theme') as Mode) || 'system');

  function apply(m: Mode) {
    document.documentElement.className = m;
    localStorage.setItem('theme', m);
  }

  $effect(() => {
    apply(mode);
  });
</script>

<select class="theme-select" bind:value={mode}>
  <option value="system">System</option>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
</select>

<style>
  .theme-select {
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    background: color-mix(in srgb, currentColor 5%, transparent);
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
  }

  .theme-select:hover {
    opacity: 0.85;
  }
</style>
