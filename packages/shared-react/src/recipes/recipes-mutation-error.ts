import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";

export type RecipesMutationErrorHandler = (error: unknown, operation: string) => void;

/** Tell the handler; a write queued for Replay keeps its optimistic state, any other rolls back. */
export function handleRecipesMutationError(
  error: unknown,
  operation: string,
  onError: RecipesMutationErrorHandler | undefined,
  rollBack: () => void
): void {
  onError?.(error, operation);

  if (!shouldPreserveOptimisticUpdate(error)) rollBack();
}
