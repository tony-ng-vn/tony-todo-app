export function createKeyedSaveQueue() {
  const pendingByKey = new Map();

  return function enqueue(key, save) {
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
  };
}
