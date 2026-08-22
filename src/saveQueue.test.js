import { describe, expect, it } from 'vitest';
import { createKeyedSaveQueue } from './saveQueue.js';

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

  it('continues with the latest save after an earlier save fails', async () => {
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
    await expect(second).resolves.toBeUndefined();
    expect(events).toEqual(['first', 'second']);
  });
});
