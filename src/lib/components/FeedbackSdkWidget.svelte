<script>
  // Import registers the <feedback-widget> custom element as a side effect.
  import "@feedback-sdk/widget";

  const endpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  const token = import.meta.env.VITE_FEEDBACK_TOKEN;
</script>

{#if endpoint && token}
  <feedback-widget {endpoint} {token}></feedback-widget>
{/if}
