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
  const SharedContext = createContext<Map<K, StoreApi<S>> | null>(null);

  /** One store per key for every Provider below, for a page that stacks several keys' screens. */
  function SharedStores({ children }: { children: ReactNode }) {
    "use memo";

    const [stores] = useState(() => new Map<K, StoreApi<S>>());

    return <SharedContext value={stores}>{children}</SharedContext>;
  }

  function Provider({ pageKey, children }: { pageKey: K; children: ReactNode }) {
    "use memo";

    const shared = use(SharedContext);
    const [page, setPage] = useState(() => ({
      key: pageKey,
      store: storeFor(shared, pageKey, create),
    }));

    if (page.key !== pageKey) setPage({ key: pageKey, store: storeFor(shared, pageKey, create) });

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

  return { Provider, SharedStores, usePageStoreApi, usePageStore };
}

// A plain function, so the compiler leaves the shared map's get-or-add alone.
function storeFor<K, S>(
  shared: Map<K, StoreApi<S>> | null,
  key: K,
  create: (key: K) => StoreApi<S>
): StoreApi<S> {
  if (!shared) return create(key);

  const store = shared.get(key) ?? create(key);

  shared.set(key, store);

  return store;
}
