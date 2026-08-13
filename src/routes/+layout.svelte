<script>
  import { dev } from '$app/environment';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
  import { installNativeWindowChrome } from '../nativeWindowChrome.js';

  let { children } = $props();

  injectAnalytics({ mode: dev ? 'development' : 'production' });
  injectSpeedInsights();

  if (typeof window !== 'undefined' && window.__doneLogNativeChrome) {
    document.documentElement.classList.add('is-native-host');
    installNativeWindowChrome(window);
  }
</script>

{@render children()}
