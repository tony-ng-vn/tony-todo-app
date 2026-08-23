export function createKeyedSaveQueue() {
  const pendingByKey = new Map();

  function enqueue(key, save) {
    const previous = pendingByKey.get(key);
    const pending = previous
      ? previous.catch(() => undefined).then(save)
      : Promise.resolve().then(save);
    pendingByKey.set(key, pending);

    return pending.finally(() => {
      if (pendingByKey.get(key) === pending) {
        pendingByKey.delete(key);
      }
    });
  }

  enqueue.flushAll = async () => {
    while (pendingByKey.size > 0) {
      await Promise.allSettled([...pendingByKey.values()]);
    }
  };

  return enqueue;
}
