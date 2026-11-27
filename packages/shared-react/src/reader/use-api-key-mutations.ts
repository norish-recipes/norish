"use client";

import { useMutation } from "@tanstack/react-query";

import { answered, wentThrough } from "../offline/settled";
import { useTRPC } from "../trpc";
import { SECRET_ANSWER } from "../trpc/one-time-secret";
import { useFailedWrite } from "./use-account-mutations";
import { useProfileCache } from "./use-profile";

/** The Reader's API keys, kept in the cached profile. */
export function useApiKeyMutations() {
  const trpc = useTRPC();
  const { write } = useProfileCache();
  const failed = useFailedWrite();

  const { mutateAsync: mutateCreate, reset: resetCreate } = useMutation(
    trpc.user.apiKeys.create.mutationOptions({
      ...SECRET_ANSWER,
      onSuccess: ({ metadata }) =>
        write((data) => ({ ...data, apiKeys: [...data.apiKeys, metadata] })),
      onError: failed("user-settings:create-api-key"),
    })
  );
  const { mutateAsync: mutateDelete } = useMutation(
    trpc.user.apiKeys.delete.mutationOptions({
      onSuccess: (_answer, { keyId }) =>
        write((data) => ({ ...data, apiKeys: data.apiKeys.filter((key) => key.id !== keyId) })),
      onError: failed("user-settings:delete-api-key"),
    })
  );
  const { mutateAsync: mutateToggle } = useMutation(
    trpc.user.apiKeys.toggle.mutationOptions({
      onSuccess: (_answer, { keyId, enabled }) =>
        write((data) => ({
          ...data,
          apiKeys: data.apiKeys.map((key) => (key.id === keyId ? { ...key, enabled } : key)),
        })),
      onError: failed("user-settings:toggle-api-key"),
    })
  );

  return {
    /** Resolves with the new key, shown only this once, or null when the create failed. */
    createApiKey: async (name?: string): Promise<string | null> =>
      (await answered(mutateCreate({ name })))?.key ?? null,
    /** Drops the created key from the mutation's result, once the reader has saved it. */
    forgetCreatedKey: () => resetCreate(),
    /** Resolves whether the delete went through; a failure is shown. */
    deleteApiKey: (keyId: string): Promise<boolean> => wentThrough(mutateDelete({ keyId })),
    /** Resolves whether the toggle went through; a failure is shown. */
    toggleApiKey: (keyId: string, enabled: boolean): Promise<boolean> =>
      wentThrough(mutateToggle({ keyId, enabled })),
  };
}
