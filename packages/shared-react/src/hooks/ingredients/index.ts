import type { CreateIngredientsHooksOptions } from "./types";
import { createUseIngredientsSubscription } from "./use-ingredients-subscription";

export type { CreateIngredientsHooksOptions } from "./types";

export { createUseIngredientsSubscription } from "./use-ingredients-subscription";

export function createIngredientsHooks({ useTRPC }: CreateIngredientsHooksOptions) {
  return { useIngredientsSubscription: createUseIngredientsSubscription({ useTRPC }) };
}
