"use client";

import type { MutationFunction, MutationFunctionContext, MutationKey } from "@tanstack/react-query";

import { markOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

import { projectedMutation } from "../trpc/projected-mutation";
import { useProfileCache } from "./use-profile";

/** Every versioned profile write runs here one at a time: each shows at once, and is sent at the
 * version the one before committed; a failed read of that version fails it unsent. */
export function useVersionedWrite() {
  const { sendVersion } = useProfileCache();

  return <TInput, TOutput, TVariables>(
    procedure: { mutationKey?: MutationKey; mutationFn?: MutationFunction<TOutput, TInput> },
    project: (variables: TVariables, version: number) => TInput
  ) => {
    const { mutationKey, mutationFn } = projectedMutation(procedure, (input: TInput) => input);

    return {
      mutationKey,
      mutationFn: async (variables: TVariables, context: MutationFunctionContext) => {
        // A failed read sent nothing, so nothing was queued either.
        const version = await sendVersion().catch((error: unknown) => {
          markOutboxAdmissionFailed(error);
          throw error;
        });

        return mutationFn(project(variables, version), context);
      },
      scope: { id: "profile-writes" },
    };
  };
}
