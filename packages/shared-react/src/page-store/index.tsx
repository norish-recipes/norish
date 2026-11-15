"use client";

import type { ReactNode } from "react";
import type { StoreApi } from "zustand";
import { createContext, use, useState } from "react";
import { useStore } from "zustand";

/**
 * A store per page, made by its provider from the page's key and made afresh when
 * the key changes. Not module-level: on the server that is one object every request shares.
 */
export function createPageStoreContext<K, S>(name: string, create: (key: K) => StoreApi<S>) {
  const Context = createContext<StoreApi<S> | null>(null);

  function Provider({ pageKey, children }: { pageKey: K; children: ReactNode }) {
    "use memo";

    const [page, setPage] = useState(() => ({ key: pageKey, store: create(pageKey) }));

    if (page.key !== pageKey) setPage({ key: pageKey, store: create(pageKey) });

    return <Context value={page.store}>{children}</Context>;
  }

  function usePageStoreApi(): StoreApi<S> {
    "use memo";

    const store = use(Context);

    if (!store) throw new Error(`${name} is missing above this component`);

    return store;
  }

  /** One slice of the page's store; renders when that slice changes. */
  function usePageStore<T>(selector: (state: S) => T): T {
    "use memo";

    return useStore(usePageStoreApi(), selector);
  }

  return { Provider, usePageStoreApi, usePageStore };
}
