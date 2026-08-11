import { describe, expect, it, vi } from 'vitest';
import { resolveLinkTitle } from './linkTitle.js';

describe('resolveLinkTitle', () => {
  it('loads the actual title for a YouTube link through oEmbed', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ title: 'Why Everyone Keeps Switching to Rust' }),
    );

    await expect(
      resolveLinkTitle('https://www.youtube.com/watch?v=iu_ALBDtoHo', { fetchImpl }),
    ).resolves.toEqual({ title: 'Why Everyone Keeps Switching to Rust' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Diu_ALBDtoHo&format=json',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });

  it('uses a readable host when a provider title is unavailable', async () => {
    await expect(
      resolveLinkTitle('https://docs.example.com/a/very/long/path', {
        fetchImpl: vi.fn(),
      }),
    ).resolves.toEqual({ title: 'docs.example.com' });
  });

  it('rejects invalid and non-web URLs', async () => {
    await expect(resolveLinkTitle('javascript:alert(1)')).rejects.toThrow('valid web URL');
    await expect(resolveLinkTitle('not a URL')).rejects.toThrow('valid web URL');
  });

  it('falls back safely when YouTube metadata fails', async () => {
    await expect(
      resolveLinkTitle('https://youtu.be/missing', {
        fetchImpl: vi.fn(async () => new Response(null, { status: 404 })),
      }),
    ).resolves.toEqual({ title: 'YouTube' });
  });
});
