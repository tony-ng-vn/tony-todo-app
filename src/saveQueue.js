export function createKeyedSaveQueue() {
  const pendingByKey = new Map();
  const failedByKey = new Map();
  let generation = 0;

  function enqueue(key, save) {
    generation += 1;
    const previous = pendingByKey.get(key);
    const pending = previous
      ? previous.catch(() => undefined).then(runSave)
      : Promise.resolve().then(runSave);
    pendingByKey.set(key, pending);

    async function runSave() {
      try {
        const result = await save();
        failedByKey.delete(key);
        return result;
      } catch (error) {
        failedByKey.set(key, error);
        throw error;
      }
    }

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

    const failure = failedByKey.values().next().value;
    if (failure) {
      throw failure;
    }
  };

  enqueue.getGeneration = () => generation;

  return enqueue;
}
