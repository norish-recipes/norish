import { useQuery } from "@tanstack/react-query";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/**
 * Where recipe ingredients go when someone adds them to the list: the built-in grocery list, or
 * Bring!. It reads "builtin" until the instance answers, so the built-in list never flickers away,
 * and always where the platform does not follow the setting (`supportsExternalShoppingList`): there
 * the query is not even made. `isLoading` is true only while an answer is awaited and nothing is
 * cached, which is when an add must not yet choose a list; `instanceProvider` is the setting as
 * the instance holds it, whatever the platform does with it.
 */
export function useGroceryListProvider() {
  const trpc = useTRPC();
  const { supportsExternalShoppingList } = usePlatform();

  const { data, isLoading } = useQuery({
    ...trpc.config.groceryListProvider.queryOptions(),
    enabled: supportsExternalShoppingList,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const instanceProvider = data ?? "builtin";
  const provider = supportsExternalShoppingList ? instanceProvider : "builtin";

  return {
    provider,
    isBring: provider === "bring",
    isLoading: supportsExternalShoppingList && isLoading,
    instanceProvider,
  };
}
