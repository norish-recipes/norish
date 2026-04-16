import type { CreateAdminHooksOptions } from "./types";
import { createUseAdminMutations } from "./use-admin-mutations";
import { createUseAdminQuery } from "./use-admin-query";

export type { CreateAdminHooksOptions } from "./types";
export { createUseAdminQuery, type AdminConfigsData } from "./use-admin-query";
export { createUseAdminMutations, type AdminMutationsResult } from "./use-admin-mutations";

export function createAdminHooks({ useTRPC }: CreateAdminHooksOptions) {
  const queries = createUseAdminQuery({ useTRPC });
  const useAdminMutations = createUseAdminMutations({
    useTRPC,
    useAdminConfigsQuery: queries.useAdminConfigsQuery,
  });

  return {
    ...queries,
    useAdminMutations,
  };
}
