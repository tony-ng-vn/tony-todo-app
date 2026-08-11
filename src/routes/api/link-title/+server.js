import { json } from '@sveltejs/kit';
import { resolveLinkTitle } from '$lib/server/linkTitle.js';

export async function GET({ url, fetch }) {
  try {
    const result = await resolveLinkTitle(url.searchParams.get('url'), { fetchImpl: fetch });
    return json(result, {
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Unable to load the link title.' },
      { status: 400 },
    );
  }
}
