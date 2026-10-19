const locks = new Map<string, Promise<void>>();

export async function withRecipeMediaLock<T>(
  recipeId: string,
  run: () => Promise<T>
): Promise<T> {
  const previous = locks.get(recipeId) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);

  locks.set(recipeId, queued);
  await previous;

  try {
    return await run();
  } finally {
    release();

    if (locks.get(recipeId) === queued) locks.delete(recipeId);
  }
}
