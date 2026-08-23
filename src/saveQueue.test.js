import { describe, expect, it } from 'vitest';
import { createKeyedSaveQueue, getTimingSaveKey } from './saveQueue.js';

describe('timing save key', () => {
  it('uses the parent task key when the edited row is a progress session', () => {
    const todos = [
      { id: 'task-1' },
      { id: 'session-1', parentTaskId: 'task-1', isProgressSession: true },
    ];

    expect(getTimingSaveKey(todos, 'session-1')).toBe('task-1');
    expect(getTimingSaveKey(todos, 'task-1')).toBe('task-1');
    expect(getTimingSaveKey(todos, 'missing')).toBe('missing');
  });
});

describe('keyed save queue', () => {
  it('finishes an earlier save before starting the next save for the same task', async () => {
    const enqueue = createKeyedSaveQueue();
    const events = [];
    let finishFirst;
    const firstGate = new Promise((resolve) => {
      finishFirst = resolve;
    });

    const first = enqueue('task-1', async () => {
      events.push('first started');
      await firstGate;
      events.push('first finished');
    });
    const second = enqueue('task-1', async () => {
      events.push('second started');
    });

    await Promise.resolve();
    expect(events).toEqual(['first started']);
    finishFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first started', 'first finished', 'second started']);
  });

  it('does not skip a failed save to run a later delta for the same task', async () => {
    const enqueue = createKeyedSaveQueue();
    const events = [];
    const first = enqueue('task-1', async () => {
      events.push('first');
      throw new Error('offline');
    });
    const second = enqueue('task-1', async () => {
      events.push('second');
    });

    await expect(first).rejects.toThrow('offline');
    await expect(second).rejects.toThrow('offline');
    expect(events).toEqual(['first', 'first']);
  });

  it('flushes saves that are queued while an earlier save is pending', async () => {
    const enqueue = createKeyedSaveQueue();
    const events = [];
    let finishFirst;
    const firstGate = new Promise((resolve) => {
      finishFirst = resolve;
    });

    void enqueue('task-1', async () => {
      events.push('first started');
      await firstGate;
      events.push('first finished');
    });
    const flushing = enqueue.flushAll().then(() => events.push('flushed'));
    void enqueue('task-1', async () => {
      events.push('second finished');
    });

    await Promise.resolve();
    expect(events).toEqual(['first started']);
    finishFirst();
    await flushing;
    expect(events).toEqual(['first started', 'first finished', 'second finished', 'flushed']);
  });

  it('tracks new saves so a stale load can detect concurrent timing changes', async () => {
    const enqueue = createKeyedSaveQueue();
    const before = enqueue.getGeneration();

    await enqueue('task-1', async () => {});

    expect(enqueue.getGeneration()).toBe(before + 1);
  });

  it('retries the exact failed operation before a later save for that key', async () => {
    const enqueue = createKeyedSaveQueue();
    const events = [];
    let deleteAttempts = 0;

    await expect(
      enqueue('task-1', async () => {
        deleteAttempts += 1;
        events.push(`delete ${deleteAttempts}`);
        if (deleteAttempts === 1) {
          throw new Error('offline');
        }
      }),
    ).rejects.toThrow('offline');

    await enqueue('task-1', async () => {
      events.push('timer update');
    });
    await expect(enqueue.flushAll()).resolves.toBeUndefined();
    expect(events).toEqual(['delete 1', 'delete 2', 'timer update']);
  });

  it('retries a failed operation once when flushing', async () => {
    const enqueue = createKeyedSaveQueue();
    let attempts = 0;

    await expect(
      enqueue('task-1', async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('offline');
        }
      }),
    ).rejects.toThrow('offline');

    await expect(enqueue.flushAll()).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });

  it('keeps the key dirty when the exact retry still fails', async () => {
    const enqueue = createKeyedSaveQueue();

    await expect(
      enqueue('task-1', async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');

    await expect(enqueue.flushAll()).rejects.toThrow('offline');
  });
});
