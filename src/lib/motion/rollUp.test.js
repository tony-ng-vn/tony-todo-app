import { afterEach, describe, expect, it, vi } from 'vitest';
import { rollUp, searchFlip } from './rollUp.js';

function fakeNode() {
  return { style: {} };
}

function stubReducedMotion(matches) {
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rollUp', () => {
  it('skips motion when search is idle', () => {
    expect(rollUp(fakeNode(), { enabled: false })).toEqual({ duration: 0 });
  });

  it('uses opacity only when reduced motion is on', () => {
    stubReducedMotion(true);
    const motion = rollUp(fakeNode(), { enabled: true });
    expect(motion.duration).toBe(140);
    expect(motion.css(0.5)).toBe('opacity: 0.5');
  });

  it('clips from the bottom while searching', () => {
    stubReducedMotion(false);
    const node = fakeNode();
    const motion = rollUp(node, { enabled: true, duration: 280 });
    expect(motion.duration).toBe(280);
    const css = motion.css(0);
    expect(css).toContain('clip-path:inset(0 0 100% 0)');
    expect(css).toContain('translateY(-10px)');
    expect(motion.css(1)).toBe('opacity:1;transform:translateY(0px);clip-path:inset(0 0 0% 0)');
  });

  it('leaves no inline styles behind on the node', () => {
    stubReducedMotion(false);
    const node = fakeNode();
    const motion = rollUp(node, { enabled: true });
    expect(motion.tick).toBeUndefined();
    expect(node.style).toEqual({});
  });
});

describe('searchFlip', () => {
  it('is instant when search is idle', () => {
    expect(searchFlip(false)).toEqual({ duration: 0 });
  });

  it('is instant under reduced motion', () => {
    stubReducedMotion(true);
    expect(searchFlip(true)).toEqual({ duration: 0 });
  });

  it('moves remaining rows while searching', () => {
    stubReducedMotion(false);
    expect(searchFlip(true).duration).toBe(260);
  });
});
