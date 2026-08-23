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
      if (failedByKey.has(key)) {
        await retryFailed(key);
      }

      try {
        return await save();
      } catch (error) {
        failedByKey.set(key, { error, save });
        throw error;
      }
    }

    return pending.finally(() => {
      if (pendingByKey.get(key) === pending) {
        pendingByKey.delete(key);
      }
    });
  }

  async function retryFailed(key) {
    const failure = failedByKey.get(key);
    if (!failure) {
      return;
    }

    try {
      await failure.save();
      if (failedByKey.get(key) === failure) {
        failedByKey.delete(key);
      }
    } catch (error) {
      failedByKey.set(key, { ...failure, error });
      throw error;
    }
  }

  enqueue.flushAll = async () => {
    let retriedFailures = false;
    while (pendingByKey.size > 0) {
      await Promise.allSettled([...pendingByKey.values()]);
    }

    if (failedByKey.size > 0) {
      retriedFailures = true;
      await Promise.allSettled([...failedByKey.keys()].map((key) => enqueue(key, async () => {})));
    }

    if (retriedFailures) {
      while (pendingByKey.size > 0) {
        await Promise.allSettled([...pendingByKey.values()]);
      }
    }

    const failure = failedByKey.values().next().value?.error;
    if (failure) {
      throw failure;
    }
  };

  enqueue.getGeneration = () => generation;

  return enqueue;
}
