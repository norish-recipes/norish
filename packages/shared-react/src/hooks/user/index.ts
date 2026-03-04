import { createUseUserAllergiesQuery } from "./use-user-allergies-query";

import type { CreateUserHooksOptions } from "./types";

export type { CreateUserHooksOptions, UserAllergies } from "./types";
export { createUseUserAllergiesQuery };

export function createUserHooks(options: CreateUserHooksOptions) {
  return {
    useUserAllergiesQuery: createUseUserAllergiesQuery(options),
  };
}
