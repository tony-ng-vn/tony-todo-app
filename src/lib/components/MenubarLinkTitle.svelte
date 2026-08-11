<script>
  import { onMount } from 'svelte';
  import { isYouTubeUrl } from '../../linkify.js';

  export let url;
  export let fallbackTitle;

  const titleCache = new Map();
  let displayTitle = fallbackTitle;

  $: isYouTube = isYouTubeUrl(url);

  onMount(() => {
    const cachedTitle = titleCache.get(url);
    if (cachedTitle) {
      displayTitle = cachedTitle;
      return;
    }

    const controller = new AbortController();
    loadTitle(controller.signal);
    return () => controller.abort();
  });

  async function loadTitle(signal) {
    try {
      const response = await fetch(`/api/link-title?url=${encodeURIComponent(url)}`, { signal });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (typeof data.title === 'string' && data.title.trim()) {
        displayTitle = data.title.trim();
        titleCache.set(url, displayTitle);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        displayTitle = fallbackTitle;
      }
    }
  }
</script>

<a
  class="menubar-task-link"
  class:has-provider-icon={isYouTube}
  data-menubar-link-title
  href={url}
  target="_blank"
  rel="noreferrer noopener"
  title={displayTitle}
>
  {#if isYouTube}
    <span class="menubar-link-provider-icon" data-youtube-icon aria-hidden="true">
      <svg viewBox="0 0 24 17">
        <rect x="0.5" y="1" width="23" height="15" rx="4" />
        <path d="M10 5.25 15.5 8.5 10 11.75z" />
      </svg>
    </span>
  {/if}
  <span class="menubar-link-title">{displayTitle}</span>
</a>

<style>
  .menubar-task-link {
    display: block;
    min-width: 0;
    color: var(--strong);
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, currentcolor 36%, transparent);
    text-underline-offset: 3px;
  }

  .menubar-task-link.has-provider-icon {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }

  .menubar-link-provider-icon,
  .menubar-link-provider-icon svg {
    display: block;
    width: 20px;
  }

  .menubar-link-provider-icon {
    color: #ff0033;
  }

  .menubar-link-provider-icon svg {
    height: auto;
  }

  .menubar-link-provider-icon rect {
    fill: currentcolor;
  }

  .menubar-link-provider-icon path {
    fill: #fff;
  }

  .menubar-link-title {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menubar-task-link:hover {
    color: var(--default);
    text-decoration-color: currentcolor;
  }

  .menubar-task-link:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    border-radius: 3px;
  }
</style>
