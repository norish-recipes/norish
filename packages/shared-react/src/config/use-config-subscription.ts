import { useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { ConfigRealtime } from "@norish/shared/contracts/realtime/config";

import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";

/**
 * An administrator's edit to reference data reads again every config read an edit can change.
 * Tags and Categories change with recipes, which this event never covers.
 */
export function useConfigSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const edited = [
    trpc.config.units.queryKey(),
    trpc.config.ingredientWords.queryKey(),
    trpc.config.recurrenceConfig.queryKey(),
    trpc.config.timerKeywords.queryKey(),
    trpc.config.timersEnabled.queryKey(),
    trpc.config.cuisines.queryKey(),
    trpc.config.localeConfig.queryKey(),
  ];

  useKeepsCurrent(edited);
  useRealtimeSubscription<PayloadOf<ConfigRealtime, "changed">>(trpc.config.onChanged, {
    catchUpQueryKeys: edited,
    onEvent: () => {
      for (const queryKey of edited) void queryClient.invalidateQueries({ queryKey });
    },
  });
}
