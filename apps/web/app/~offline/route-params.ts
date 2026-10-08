const paramsById = new Map<string, Promise<{ id: string }>>();

/**
 * The `params` a reused route's `use(params)` reads, one promise per id. A
 * promise made during render is a new one on every retry while it suspends,
 * which React refuses (error #482), so it must outlive the render.
 */
export function routeParams(id: string): Promise<{ id: string }> {
  let params = paramsById.get(id);

  if (!params) {
    params = Promise.resolve({ id });
    paramsById.set(id, params);
  }

  return params;
}
