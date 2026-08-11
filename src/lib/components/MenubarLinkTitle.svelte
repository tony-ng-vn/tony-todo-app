<script>
  import { onMount } from 'svelte';

  export let url;
  export let fallbackTitle;

  const titleCache = new Map();
  let displayTitle = fallbackTitle;

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
  data-menubar-link-title
  href={url}
  target="_blank"
  rel="noreferrer noopener"
>{displayTitle}</a>

<style>
  .menubar-task-link {
    display: block;
    min-width: 0;
    overflow: hidden;
    color: var(--strong);
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, currentcolor 36%, transparent);
    text-overflow: ellipsis;
    text-underline-offset: 3px;
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
