import { useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { ConfigRealtime } from "@norish/shared/contracts/realtime/config";
import type { ListsRealtime } from "@norish/shared/contracts/realtime/lists";

import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";

/**
 * An administrator's edit to reference data reads again every config read an edit can change;
 * a change to the household's Tags, Cuisines or Categories reads its lists again (ADR-0043).
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
  const edited = [
    trpc.config.units.queryKey(),
    trpc.config.ingredientWords.queryKey(),
    trpc.config.recurrenceConfig.queryKey(),
    trpc.config.timerKeywords.queryKey(),
    trpc.config.timersEnabled.queryKey(),
    trpc.config.localeConfig.queryKey(),
    ...listKeys,
  ];
  const reread = (keys: typeof edited) => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };

  useKeepsCurrent(edited);
  useRealtimeSubscription<PayloadOf<ConfigRealtime, "changed">>(trpc.config.onChanged, {
    liveQueryKeys: edited,
    onEvent: () => reread(edited),
  });
  // A renamed, merged or deleted entry also changes the recipes carrying it.
  useRealtimeSubscription<PayloadOf<ListsRealtime, "changed">>(trpc.lists.onChanged, {
    liveQueryKeys: listKeys,
    onEvent: () => {
      reread(listKeys);
      void queryClient.invalidateQueries(trpc.library.list.pathFilter());
    },
  });
}
