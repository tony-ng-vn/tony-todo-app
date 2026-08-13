import { json } from '@sveltejs/kit';
import { resolveNativeRelease } from '$lib/server/nativeRelease.js';

export async function GET({ fetch }) {
  const result = await resolveNativeRelease({ fetchImpl: fetch });
  return json(result, {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}
