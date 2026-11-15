import type { MutationFunction, MutationFunctionContext, MutationKey } from "@tanstack/react-query";

/** A procedure's mutation key and send, taking the hook's own variables and projecting them to its input. */
export function projectedMutation<TInput, TOutput, TVariables>(
  procedure: { mutationKey?: MutationKey; mutationFn?: MutationFunction<TOutput, TInput> },
  project: (variables: TVariables) => TInput
) {
  const { mutationKey, mutationFn } = procedure;

  return {
    mutationKey,
    mutationFn: (variables: TVariables, context: MutationFunctionContext) => {
      if (!mutationFn) throw new Error("tRPC mutation options came without a mutationFn");

      return mutationFn(project(variables), context);
    },
  };
}
