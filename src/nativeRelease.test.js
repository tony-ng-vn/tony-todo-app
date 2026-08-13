import { describe, expect, it, vi } from 'vitest';
import { resolveNativeRelease } from './lib/server/nativeRelease.js';

describe('resolveNativeRelease', () => {
  it('reports the signed bootstrap asset when it exists', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assets: [
            {
              name: 'Done-Log.dmg',
              browser_download_url:
                'https://github.com/tony-ng-vn/tony-todo-app/releases/download/v1.0.0/Done-Log.dmg',
            },
          ],
        }),
      ),
    );

    await expect(resolveNativeRelease({ fetchImpl })).resolves.toEqual({ available: true });
  });

  it('keeps the installer unavailable before the first native release', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

    await expect(resolveNativeRelease({ fetchImpl })).resolves.toEqual({ available: false });
  });
});
