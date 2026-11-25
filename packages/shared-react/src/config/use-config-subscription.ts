import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { ConfigRealtime } from "@norish/shared/contracts/realtime/config";
import type { ListsRealtime } from "@norish/shared/contracts/realtime/lists";

import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";

/**
 * An administrator's edit to reference data reads again every config read an edit can change;
 * a change to a household's or the instance's lists also every read showing their names (ADR-0043).
 */
export function useConfigSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKeys = [
    trpc.config.tags.queryKey(),
    trpc.config.categories.queryKey(),
    trpc.config.cuisines.queryKey(),
    trpc.lists.list.pathKey(),
  ];
  // An entry renamed, merged, deleted or newly carried shows on recipes and in Search too.
  const showingNames = [
    ...listKeys,
    trpc.recipes.list.pathKey(),
    trpc.recipes.get.pathKey(),
    trpc.library.pathKey(),
    trpc.cookbooks.recipes.pathKey(),
  ];
  const edited = [
    trpc.config.units.queryKey(),
    trpc.config.ingredientWords.queryKey(),
    trpc.config.recurrenceConfig.queryKey(),
    trpc.config.timerKeywords.queryKey(),
    trpc.config.timersEnabled.queryKey(),
    trpc.config.localeConfig.queryKey(),
  ];
  const reread = (keys: readonly QueryKey[]) => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };

  useKeepsCurrent([...edited, ...listKeys]);
  useRealtimeSubscription<PayloadOf<ConfigRealtime, "changed">>(trpc.config.onChanged, {
    liveQueryKeys: [...edited, ...showingNames],
    onEvent: () => reread([...edited, ...showingNames]),
  });
  useRealtimeSubscription<PayloadOf<ListsRealtime, "changed">>(trpc.lists.onChanged, {
    liveQueryKeys: showingNames,
    onEvent: () => reread(showingNames),
  });
}
