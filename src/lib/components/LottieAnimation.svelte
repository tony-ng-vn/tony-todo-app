<script>
  import { onDestroy, onMount } from 'svelte';

  export let path;
  export let loop = false;
  export let autoplay = true;
  export let ariaLabel = 'Animation';

  let container;
  let animation;

  onMount(async () => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !container || !path) {
      return;
    }

    const { default: lottie } = await import('lottie-web/build/player/lottie_light');
    animation = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop,
      autoplay,
      path,
      rendererSettings: {
        progressiveLoad: true,
      },
    });
  });

  onDestroy(() => {
    animation?.destroy();
  });
</script>

<div bind:this={container} class="lottie-animation" role="img" aria-label={ariaLabel}></div>
