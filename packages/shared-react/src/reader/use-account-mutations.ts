"use client";

import { useMutation } from "@tanstack/react-query";

import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";

import { showRefusal, usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { settled } from "./settled";
import { useProfileCache } from "./use-profile";

type Answer = { success: boolean; error?: string };

/** A failed write's `onError`: reread the profile and tell the reader. */
function useFailedWrite() {
  const { showError } = usePlatform();
  const { invalidate } = useProfileCache();

  return (context: string) => (error: unknown) => {
    invalidate();
    showError(error, context);
  };
}

/** The Reader's name and Avatar; each answers with the user as it now is. */
export function useProfileMutations() {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const { version, mergeUser } = useProfileCache();
  const failed = useFailedWrite();

  const settle = (context: string) => ({
    onSuccess: (answer: Answer & { user?: Parameters<typeof mergeUser>[0] }) => {
      if (answer.success && answer.user) mergeUser(answer.user);
      else if (!answer.success) showRefusal(showError, answer, context);
    },
    onError: failed(context),
  });
  const settleName = settle("user-settings:update-name");
  const settleUpload = settle("user-settings:upload-avatar");
  const settleDelete = settle("user-settings:delete-avatar");

  const { mutateAsync: mutateName } = useMutation(trpc.user.updateName.mutationOptions(settleName));
  const { mutateAsync: mutateUpload } = useMutation(
    trpc.user.uploadAvatar.mutationOptions(settleUpload)
  );
  const { mutateAsync: mutateDelete, isPending: isDeletingAvatar } = useMutation(
    trpc.user.deleteAvatar.mutationOptions(settleDelete)
  );

  return {
    /** Resolves once settled, so the save goes on to the Avatar; an empty name is refused here. */
    updateName: async (name: string): Promise<void> => {
      if (!name.trim()) {
        toast.show({
          severity: "danger",
          title: toast.translate("common.errors.nameCannotBeEmpty"),
        });

        return;
      }

      await settled(mutateName({ name, version: version() }));
    },
    /** Rejects when the upload fails, which the reader is shown. */
    uploadAvatar: async (file: File): Promise<void> => {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("version", String(version()));
      const answer = await mutateUpload(formData);

      if (!answer.success) throw new Error(answer.error);
    },
    /** Rejects when the delete fails, which the reader is shown. */
    deleteAvatar: async (): Promise<void> => {
      const answer = await mutateDelete({ version: version() });

      if (!answer.success) throw new Error(answer.error);
    },
    isDeletingAvatar,
  };
}

/** The Reader's account-wide Preferences, changed optimistically. */
export function usePreferencesMutation() {
  const trpc = useTRPC();
  const { held, version, write, restore, mergeUser, invalidate } = useProfileCache();
  const failed = useFailedWrite();

  const merge = (patch: Partial<UserPreferencesDto>) =>
    write((data) => ({
      ...data,
      user: { ...data.user, preferences: { ...data.user.preferences, ...patch } },
    }));

  const { mutateAsync, isPending } = useMutation(
    trpc.user.updatePreferences.mutationOptions({
      onMutate: ({ preferences }) => {
        const previous = held();

        merge(preferences);

        return { previous };
      },
      onSuccess: (answer, _input, context) => {
        if (!answer.success) {
          restore(context.previous);
          invalidate();

          return;
        }
        if (answer.version) mergeUser({ version: answer.version });
        merge(answer.preferences ?? {});
      },
      onError: (error, _input, context) => {
        restore(context?.previous);
        failed("user-settings:update-preferences")(error);
      },
    })
  );

  return {
    /** Resolves once settled, whatever the outcome, so a language change refreshes after it. */
    updatePreferences: (preferences: Partial<UserPreferencesDto>): Promise<void> =>
      settled(mutateAsync({ preferences, version: version() })),
    isUpdatingPreferences: isPending,
  };
}

/** The Reader's API keys, kept in the cached profile. */
export function useApiKeyMutations() {
  const trpc = useTRPC();
  const { write } = useProfileCache();
  const failed = useFailedWrite();

  const { mutateAsync: mutateCreate } = useMutation(
    trpc.user.apiKeys.create.mutationOptions({
      onSuccess: ({ metadata }) =>
        write((data) => ({ ...data, apiKeys: [...data.apiKeys, metadata] })),
      onError: failed("user-settings:create-api-key"),
    })
  );
  const { mutate: mutateDelete } = useMutation(
    trpc.user.apiKeys.delete.mutationOptions({
      onSuccess: (_answer, { keyId }) =>
        write((data) => ({ ...data, apiKeys: data.apiKeys.filter((key) => key.id !== keyId) })),
      onError: failed("user-settings:delete-api-key"),
    })
  );
  const { mutate: mutateToggle } = useMutation(
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
    /** Resolves with the new key, shown only this once. */
    createApiKey: async (name?: string): Promise<string> => (await mutateCreate({ name })).key,
    deleteApiKey: (keyId: string) => mutateDelete({ keyId }),
    toggleApiKey: (keyId: string, enabled: boolean) => mutateToggle({ keyId, enabled }),
  };
}

/** Deletes the Reader's account and signs out on this device. */
export function useDeleteAccountMutation() {
  const trpc = useTRPC();
  const { signOut, showError } = usePlatform();
  const context = "user-settings:delete-account";

  const { mutate } = useMutation(
    trpc.user.deleteAccount.mutationOptions({
      onSuccess: (answer) => {
        if (answer.success) void signOut({ accountDeleted: true });
        else showRefusal(showError, answer, context);
      },
      onError: (error) => showError(error, context),
    })
  );

  return { deleteAccount: () => mutate() };
}
