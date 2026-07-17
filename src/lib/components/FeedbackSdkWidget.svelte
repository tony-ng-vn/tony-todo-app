<script>
  import { onMount } from 'svelte';

  const endpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  const token = import.meta.env.VITE_FEEDBACK_TOKEN;

  // The widget defines a browser custom element (class extends HTMLElement),
  // which throws under SvelteKit's server-side rendering. Import it on the
  // client only; the <feedback-widget> tag below upgrades once it registers.
  onMount(async () => {
    if (endpoint && token) {
      await import('feedback-sdk-widget');
    }
  });
</script>

{#if endpoint && token}
  <feedback-widget {endpoint} {token}></feedback-widget>
{/if}
