import type { inferRouterOutputs } from "@trpc/server";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

type UserOutputs = inferRouterOutputs<AppRouter>["user"];
type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;

export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;
export type UserAllergies = UserOutputs["getAllergies"]["allergies"];

export interface CreateUserHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
