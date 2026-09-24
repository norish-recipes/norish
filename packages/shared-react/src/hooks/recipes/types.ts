import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;

export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export interface CreateRecipeHooksOptions {
  useTRPC: () => TrpcHookBinding;
  shouldPreserveOptimisticUpdate?: (error: unknown) => boolean;
}
