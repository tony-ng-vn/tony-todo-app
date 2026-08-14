export const TASK_PHOTO_BUCKET = 'task-photos';
export const TASK_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const LOCAL_TASK_PHOTO_KEY = 'local';

const PHOTO_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function validateTaskPhoto(file) {
  if (!file) {
    return { ok: false, error: 'Choose a photo to attach.' };
  }

  if (!PHOTO_EXTENSIONS[file.type]) {
    return { ok: false, error: 'Use a JPEG, PNG, WebP, or GIF photo.' };
  }

  if (file.size > TASK_PHOTO_MAX_BYTES) {
    return { ok: false, error: 'Keep the photo under 5 MB.' };
  }

  return { ok: true };
}

export function taskPhotoObjectKey(userId, todoId, mimeType) {
  const extension = PHOTO_EXTENSIONS[mimeType] ?? 'jpg';
  return `${userId}/${todoId}/photo.${extension}`;
}

export function isRemoteTaskPhotoKey(photoKey) {
  return Boolean(photoKey) && photoKey !== LOCAL_TASK_PHOTO_KEY;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('The photo could not be read.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadTaskPhoto(client, { userId, todo, file }) {
  const check = validateTaskPhoto(file);
  if (!check.ok) {
    return { data: null, error: new Error(check.error) };
  }

  const key = taskPhotoObjectKey(userId, todo.id, file.type);
  const { data, error } = await client.storage.from(TASK_PHOTO_BUCKET).upload(key, file);
  if (error) {
    return { data: null, error };
  }

  signedUrlCache.delete(data.key);
  const previousKey = todo.photoKey;
  if (isRemoteTaskPhotoKey(previousKey) && previousKey !== data.key) {
    signedUrlCache.delete(previousKey);
    await client.storage.from(TASK_PHOTO_BUCKET).remove(previousKey);
  }

  return {
    data: { photoUrl: data.url, photoKey: data.key },
    error: null,
  };
}

export async function removeTaskPhotoObject(client, photoKey) {
  if (!isRemoteTaskPhotoKey(photoKey)) {
    return { error: null };
  }

  signedUrlCache.delete(photoKey);
  const { error } = await client.storage.from(TASK_PHOTO_BUCKET).remove(photoKey);
  return { error };
}

export async function cleanupTodoPhotos(client, todos) {
  await Promise.all((todos ?? []).map((todo) => removeTaskPhotoObject(client, todo?.photoKey)));
}

// Signed URLs live for an hour, but the reactive photo field re-resolves on
// every store invalidation (once per second while a timer runs). Cache per
// object key and refresh shortly before expiry; upload and removal above
// invalidate their key so a replaced or deleted photo never serves stale.
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const signedUrlCache = new Map();

export async function resolveTaskPhotoSrc(client, todo) {
  if (!todo?.photoUrl && !isRemoteTaskPhotoKey(todo?.photoKey)) {
    return null;
  }

  if (!isRemoteTaskPhotoKey(todo.photoKey) || !client?.storage) {
    return todo.photoUrl ?? null;
  }

  const cached = signedUrlCache.get(todo.photoKey);
  if (cached && cached.expiresAt - SIGNED_URL_REFRESH_MARGIN_MS > Date.now()) {
    return cached.url;
  }

  const { data, error } = await client.storage
    .from(TASK_PHOTO_BUCKET)
    .createSignedUrl(todo.photoKey, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return todo.photoUrl ?? null;
  }

  signedUrlCache.set(todo.photoKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}
