import type { CreateUserHooksOptions } from "./types";
import { createUseUserAllergiesQuery } from "./use-user-allergies-query";

export type { CreateUserHooksOptions, UserAllergies } from "./types";
export { createUseUserAllergiesQuery };
export { createUseActiveAllergies, type UseActiveAllergiesResult } from "./use-active-allergies";

export function createUserHooks(options: CreateUserHooksOptions) {
  return {
    useUserAllergiesQuery: createUseUserAllergiesQuery(options),
  };
}
