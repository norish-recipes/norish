// Polyfill for Rolldown chunk split bug
if (!(globalThis as any).__exportAll) {
  (globalThis as any).__exportAll = (target: any, all: any) => {
    for (const name in all) {
      Object.defineProperty(target, name, { get: all[name], enumerable: true });
    }
    return target;
  };
}
