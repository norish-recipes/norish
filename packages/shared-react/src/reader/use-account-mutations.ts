"use client";

import { useIsMutating, useMutation } from "@tanstack/react-query";

import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import { uploadForm } from "@norish/shared/lib/upload-form";

import type { WriteResult } from "../offline/settled";
import { accepted, answered, settled } from "../offline/settled";
import { showRefusal, usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { dropAndLeave, runSessionEnd } from "./session-end";
import { tookIt, useStaleRefusal } from "./stale-write";
import { useProfileCache } from "./use-profile";

/** A failed write's `onError`: reread the profile and tell the reader. */
function useFailedWrite() {
  const { showError } = usePlatform();
  const { invalidate } = useProfileCache();

  return (context: string) => (error: unknown) => {
    void invalidate();
    showError(error, context);
  };
}

type ProfileAnswer = WriteResult & { stale?: boolean };

/** The Reader's name and Avatar; each answers with the user as it now is. */
export function useProfileMutations() {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const { version, mergeUser, invalidate } = useProfileCache();
  const failed = useFailedWrite();
  const refuseStale = useStaleRefusal();

  // A stale write is refused as changed elsewhere and resolves once the profile is reread.
  const settle = (context: string) => ({
    onSuccess: (answer: ProfileAnswer & { user?: Parameters<typeof mergeUser>[0] }) => {
      if (answer.stale) {
        refuseStale(context);

        return invalidate();
      }
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
    /** Resolves whether the name went through; an empty name is refused here. */
    updateName: async (name: string): Promise<boolean> => {
      if (!name.trim()) {
        toast.show({
          severity: "danger",
          title: toast.translate("common.errors.nameCannotBeEmpty"),
        });

        return false;
      }

      return tookIt(mutateName({ name, version: version() }));
    },
    /** Resolves whether the upload went through; the reader is shown why not. */
    uploadAvatar: (file: Blob): Promise<boolean> =>
      tookIt(mutateUpload(uploadForm({ file, version: version() }))),
    /** Resolves whether the delete went through; the reader is shown why not. */
    deleteAvatar: (): Promise<boolean> => tookIt(mutateDelete({ version: version() })),
    isDeletingAvatar,
  };
}

/** The Reader's account-wide Preferences, changed optimistically. */
export function usePreferencesMutation() {
  const trpc = useTRPC();
  const { held, version, mergeUser, mergePreferences: merge, invalidate } = useProfileCache();
  const failed = useFailedWrite();
  const refuseStale = useStaleRefusal();
  // Counts the language save too, which is its own mutation sending the same held version.
  const saving = useIsMutating({ mutationKey: trpc.user.updatePreferences.mutationKey() }) > 0;

  const { mutateAsync } = useMutation(
    trpc.user.updatePreferences.mutationOptions({
      // A rollback puts back only the fields this write changed, never a sibling's or the version.
      onMutate: ({ preferences }) => {
        const shown: Partial<UserPreferencesDto> = held()?.user.preferences ?? {};
        const previous = Object.fromEntries(
          Object.keys(preferences).map((key) => [key, shown[key as keyof UserPreferencesDto]])
        );

        merge(preferences);

        return { previous };
      },
      onSuccess: (answer, _input, context) => {
        if (!answer.success) {
          merge(context.previous);
          void invalidate();

          return;
        }
        // A stale answer carries the stored choices and version, which replace the optimistic copy.
        if (answer.stale) refuseStale("user-settings:update-preferences");
        if (answer.version) mergeUser({ version: answer.version });
        merge(answer.preferences ?? {});
      },
      onError: (error, _input, context) => {
        if (context) merge(context.previous);
        failed("user-settings:update-preferences")(error);
      },
    })
  );

  return {
    /** Resolves once settled, whatever the outcome, so a language change refreshes after it. */
    updatePreferences: (preferences: Partial<UserPreferencesDto>): Promise<void> =>
      settled(mutateAsync({ preferences, version: version() })),
    isUpdatingPreferences: saving,
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
    /** Resolves with the new key, shown only this once, or null when the create failed. */
    createApiKey: async (name?: string): Promise<string | null> =>
      (await answered(mutateCreate({ name })))?.key ?? null,
    deleteApiKey: (keyId: string) => mutateDelete({ keyId }),
    toggleApiKey: (keyId: string, enabled: boolean) => mutateToggle({ keyId, enabled }),
  };
}

/** Deletes the Reader's account, then drops and clears this device, Outbox included, and leaves as a Sign-out. */
export function useDeleteAccountMutation() {
  const trpc = useTRPC();
  const platform = usePlatform();
  const context = "user-settings:delete-account";

  const { mutateAsync } = useMutation(
    trpc.user.deleteAccount.mutationOptions({
      // Never queued: a delete made Offline would otherwise replay later, unseen.
      trpc: { context: { skipOutboxCapture: true } },
      onSuccess: (answer) => {
        if (!answer.success) showRefusal(platform.showError, answer, context);
      },
      onError: (error) => platform.showError(error, context),
    })
  );

  // Runs inside the guard: a Session Expiry the delete causes is ignored, or runs after a delete that failed.
  return {
    deleteAccount: () =>
      void runSessionEnd(async () => {
        if (await accepted(mutateAsync())) await dropAndLeave(platform, true, "sign-out");
      }),
  };
}
