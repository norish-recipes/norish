import type { AppRouter } from "@norish/trpc/client";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export interface CreateRatingsHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
