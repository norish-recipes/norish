import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export interface CreateRatingsHooksOptions {
  useTRPC: () => TrpcHookBinding;
  shouldPreserveOptimisticUpdate?: (error: unknown) => boolean;
}
