import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TASK_PHOTO_BUCKET,
  TASK_PHOTO_MAX_BYTES,
  cleanupTodoPhotos,
  isRemoteTaskPhotoKey,
  removeTaskPhotoObject,
  resolveTaskPhotoSrc,
  taskPhotoObjectKey,
  uploadTaskPhoto,
  validateTaskPhoto,
} from './todoPhoto.js';

function photoFile({ name = 'shot.jpg', type = 'image/jpeg', size = 12 } = {}) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateTaskPhoto', () => {
  it('accepts a jpeg under the size cap', () => {
    expect(validateTaskPhoto(photoFile())).toEqual({ ok: true });
  });

  it('rejects a missing file', () => {
    expect(validateTaskPhoto(null)).toEqual({
      ok: false,
      error: 'Choose a photo to attach.',
    });
  });

  it('rejects a non-image type', () => {
    expect(validateTaskPhoto(photoFile({ name: 'notes.pdf', type: 'application/pdf' }))).toEqual({
      ok: false,
      error: 'Use a JPEG, PNG, WebP, or GIF photo.',
    });
  });

  it('rejects a file over the size cap', () => {
    expect(validateTaskPhoto(photoFile({ size: TASK_PHOTO_MAX_BYTES + 1 }))).toEqual({
      ok: false,
      error: 'Keep the photo under 5 MB.',
    });
  });
});

describe('task photo storage key', () => {
  it('scopes the object to the owner and task', () => {
    expect(taskPhotoObjectKey('user-1', 'task-9', 'image/png')).toBe('user-1/task-9/photo.png');
    expect(TASK_PHOTO_BUCKET).toBe('task-photos');
  });

  it('treats only non-local keys as remote storage objects', () => {
    expect(isRemoteTaskPhotoKey('user-1/task-9/photo.jpg')).toBe(true);
    expect(isRemoteTaskPhotoKey('local')).toBe(false);
    expect(isRemoteTaskPhotoKey(null)).toBe(false);
  });
});

describe('uploadTaskPhoto', () => {
  it('uploads to the task-photos bucket and returns url plus key', async () => {
    const calls = [];
    const client = {
      storage: {
        from(bucket) {
          calls.push(['from', bucket]);
          return {
            async upload(path, file) {
              calls.push(['upload', path, file.name]);
              return { data: { url: 'https://files.example/photo.jpg', key: path }, error: null };
            },
          };
        },
      },
    };
    const file = photoFile();

    const result = await uploadTaskPhoto(client, {
      userId: 'user-1',
      todo: { id: 'task-9', photoKey: null },
      file,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      photoUrl: 'https://files.example/photo.jpg',
      photoKey: 'user-1/task-9/photo.jpg',
    });
    expect(calls).toEqual([
      ['from', 'task-photos'],
      ['upload', 'user-1/task-9/photo.jpg', 'shot.jpg'],
    ]);
  });

  it('deletes the previous remote object when the key changes', async () => {
    const removed = [];
    const client = {
      storage: {
        from() {
          return {
            async upload(path) {
              return { data: { url: 'https://files.example/photo.png', key: path }, error: null };
            },
            async remove(key) {
              removed.push(key);
              return { error: null };
            },
          };
        },
      },
    };

    await uploadTaskPhoto(client, {
      userId: 'user-1',
      todo: { id: 'task-9', photoKey: 'user-1/task-9/photo.jpg' },
      file: photoFile({ name: 'shot.png', type: 'image/png' }),
    });

    expect(removed).toEqual(['user-1/task-9/photo.jpg']);
  });

  it('skips storage delete for a local-only photo key', async () => {
    const { error } = await removeTaskPhotoObject({ storage: { from() {} } }, 'local');
    expect(error).toBeNull();
  });

  it('removes every remote photo when a task and its sessions are deleted', async () => {
    const removed = [];
    const client = {
      storage: {
        from() {
          return {
            async remove(key) {
              removed.push(key);
              return { error: null };
            },
          };
        },
      },
    };

    await cleanupTodoPhotos(client, [
      { photoKey: 'user-1/task-9/photo.jpg' },
      { photoKey: 'local' },
      { photoKey: null },
      { photoKey: 'user-1/session-1/photo.png' },
    ]);

    expect(removed).toEqual(['user-1/task-9/photo.jpg', 'user-1/session-1/photo.png']);
  });
});

function signingClient() {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    storage: {
      from() {
        return {
          async createSignedUrl() {
            calls += 1;
            return { data: { signedUrl: `signed-${calls}` }, error: null };
          },
          async remove() {
            return { error: null };
          },
        };
      },
    },
  };
}

describe('resolveTaskPhotoSrc caching', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mints one signed url for repeated resolves of the same photo', async () => {
    const client = signingClient();
    const todo = { photoUrl: 'https://example.test/p', photoKey: 'user-1/cache-a/photo.jpg' };

    const first = await resolveTaskPhotoSrc(client, todo);
    const second = await resolveTaskPhotoSrc(client, todo);

    expect(first).toBe('signed-1');
    expect(second).toBe('signed-1');
    expect(client.calls).toBe(1);
  });

  it('mints a fresh url once the cached one nears expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'));
    const client = signingClient();
    const todo = { photoUrl: 'https://example.test/p', photoKey: 'user-1/cache-b/photo.jpg' };

    await resolveTaskPhotoSrc(client, todo);
    vi.setSystemTime(new Date('2026-08-14T12:56:00Z'));
    const refreshed = await resolveTaskPhotoSrc(client, todo);

    expect(refreshed).toBe('signed-2');
    expect(client.calls).toBe(2);
  });

  it('drops the cached url when the photo object is removed', async () => {
    const client = signingClient();
    const todo = { photoUrl: 'https://example.test/p', photoKey: 'user-1/cache-c/photo.jpg' };

    await resolveTaskPhotoSrc(client, todo);
    await removeTaskPhotoObject(client, todo.photoKey);
    const after = await resolveTaskPhotoSrc(client, todo);

    expect(after).toBe('signed-2');
    expect(client.calls).toBe(2);
  });
});
