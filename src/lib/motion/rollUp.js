const EASE_OUT_QUART = (t) => 1 - (1 - t) ** 4;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function rollUp(_node, { enabled = true, duration = 280 } = {}) {
  if (!enabled) {
    return { duration: 0 };
  }

  if (prefersReducedMotion()) {
    return {
      duration: 140,
      css: (t) => `opacity: ${t}`,
    };
  }

  return {
    duration,
    easing: EASE_OUT_QUART,
    css: (t) => {
      const fold = (1 - t) * 100;
      const lift = (1 - t) * -10;
      return `opacity:${t};transform:translateY(${lift}px);clip-path:inset(0 0 ${fold}% 0)`;
    },
  };
}

export function searchFlip(enabled) {
  if (!enabled || prefersReducedMotion()) {
    return { duration: 0 };
  }

  return {
    duration: 260,
    easing: EASE_OUT_QUART,
  };
}
