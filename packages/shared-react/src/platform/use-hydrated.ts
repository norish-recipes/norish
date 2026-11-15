import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/** False on the server and while hydrating, like the markup the server sent; true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  );
}
