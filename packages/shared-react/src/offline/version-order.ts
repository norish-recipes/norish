/** Whether a reply or event at `version` is older than the `held` version the cache has; a cache
 * with no version, persisted before versions, holds an older one. */
export const olderThanHeld = (version: number, held: number | undefined): boolean =>
  held !== undefined && version < held;
