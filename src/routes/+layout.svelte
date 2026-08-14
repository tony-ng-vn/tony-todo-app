<script>
  import { dev } from '$app/environment';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
  import { installNativeWindowChrome } from '../nativeWindowChrome.js';
  import { shouldLoadWebTelemetry } from '../webTelemetry.js';

  let { children } = $props();

  const nativeHost =
    typeof window !== 'undefined' &&
    Boolean(window.__doneLogNativeChrome || window.__doneLogNativeHost);

  if (
    typeof window !== 'undefined' &&
    shouldLoadWebTelemetry({ pathname: window.location.pathname, nativeHost })
  ) {
    injectAnalytics({ mode: dev ? 'development' : 'production' });
    injectSpeedInsights();
  }

  if (typeof window !== 'undefined' && window.__doneLogNativeChrome) {
    document.documentElement.classList.add('is-native-host');
    installNativeWindowChrome(window);
  }
</script>

{@render children()}
