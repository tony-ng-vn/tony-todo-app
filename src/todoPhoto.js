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

  const previousKey = todo.photoKey;
  if (isRemoteTaskPhotoKey(previousKey) && previousKey !== data.key) {
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

  const { error } = await client.storage.from(TASK_PHOTO_BUCKET).remove(photoKey);
  return { error };
}

export async function resolveTaskPhotoSrc(client, todo) {
  if (!todo?.photoUrl && !isRemoteTaskPhotoKey(todo?.photoKey)) {
    return null;
  }

  if (!isRemoteTaskPhotoKey(todo.photoKey) || !client?.storage) {
    return todo.photoUrl ?? null;
  }

  const { data, error } = await client.storage
    .from(TASK_PHOTO_BUCKET)
    .createSignedUrl(todo.photoKey, 3600);

  if (error || !data?.signedUrl) {
    return todo.photoUrl ?? null;
  }

  return data.signedUrl;
}
