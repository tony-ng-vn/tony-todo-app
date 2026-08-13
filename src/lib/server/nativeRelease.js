const LATEST_RELEASE_URL =
  'https://api.github.com/repos/tony-ng-vn/tony-todo-app/releases/latest';
const BOOTSTRAP_ASSET_NAME = 'Done-Log.dmg';

export async function resolveNativeRelease({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(LATEST_RELEASE_URL, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'done-log-release-check',
    },
  });
  if (!response.ok) {
    return { available: false };
  }

  const release = await response.json();
  const asset = release.assets?.find((candidate) => candidate.name === BOOTSTRAP_ASSET_NAME);
  return { available: Boolean(asset?.browser_download_url) };
}
