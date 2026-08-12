<script>
  import { iconMoon, iconSun } from './icons.js';

  export let themeMode = 'light';
  export let onToggle;
  export let compact = false;
</script>

<button
  type="button"
  class="theme-toggle"
  class:is-compact={compact}
  on:click={onToggle}
  aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
  title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
>
  {#key themeMode}
    <span class="theme-toggle-icon" aria-hidden="true">
      {@html themeMode === 'dark' ? iconSun() : iconMoon()}
    </span>
  {/key}
  {#if !compact}
    <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
  {/if}
</button>
