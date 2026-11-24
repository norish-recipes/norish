"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";

import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import type { AppRouter } from "@norish/trpc/client";
import { uploadForm } from "@norish/shared/lib/upload-form";

import type { WriteResult } from "../offline/settled";
import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { accepted } from "../offline/settled";
import { showRefusal, usePlatform } from "../platform";
import { acceptedFresh, useStaleRefusal } from "../platform/stale-write";
import { useTRPC } from "../trpc";
import { dropAndLeave, runSessionEnd } from "./session-end";
import { useProfileCache } from "./use-profile";

/** A failed write's `onError`: reread the profile and tell the reader; a write the Outbox queued did not fail. */
export function useFailedWrite() {
  const { showError } = usePlatform();
  const { invalidate } = useProfileCache();

  return (context: string) => (error: unknown) => {
    if (shouldPreserveOptimisticUpdate(error)) return;
    void invalidate();
    showError(error, context);
  };
}

/** The last versioned profile write sent from each cache, so the next one reads the version it committed. */
const lastSend = new WeakMap<QueryClient, Promise<unknown>>();

/** Sends `write` at the profile's version once every earlier versioned write settled; a failed read
 * of the version fails the write unsent, shown as a failed save. */
function useVersionedSend() {
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const { sendVersion } = useProfileCache();

  return <T>(context: string, write: (version: number) => Promise<T>): Promise<T> => {
    const sent = (lastSend.get(queryClient) ?? Promise.resolve())
      .then(() =>
        sendVersion().catch((error: unknown) => {
          showError(error, context);
          throw error;
        })
      )
      .then(write);

    lastSend.set(
      queryClient,
      sent.catch(() => undefined)
    );

    return sent;
  };
}

type ProfileAnswer = WriteResult & { stale?: boolean };

/** The Reader's name and Avatar; each answers with the user as it now is. */
export function useProfileMutations() {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const { mergeUser, invalidate } = useProfileCache();
  const failed = useFailedWrite();
  const send = useVersionedSend();
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
  const nameContext = "user-settings:update-name";
  const uploadContext = "user-settings:upload-avatar";
  const deleteContext = "user-settings:delete-avatar";

  const { mutateAsync: mutateName } = useMutation(
    trpc.user.updateName.mutationOptions(settle(nameContext))
  );
  const { mutateAsync: mutateUpload } = useMutation(
    trpc.user.uploadAvatar.mutationOptions(settle(uploadContext))
  );
  const { mutateAsync: mutateDelete, isPending: isDeletingAvatar } = useMutation(
    trpc.user.deleteAvatar.mutationOptions(settle(deleteContext))
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

      return acceptedFresh(send(nameContext, (version) => mutateName({ name, version })));
    },
    /** Resolves whether the upload went through; the reader is shown why not. */
    uploadAvatar: (file: Blob): Promise<boolean> =>
      acceptedFresh(send(uploadContext, (version) => mutateUpload(uploadForm({ file, version })))),
    /** Resolves whether the delete went through; the reader is shown why not. */
    deleteAvatar: (): Promise<boolean> =>
      acceptedFresh(send(deleteContext, (version) => mutateDelete({ version }))),
    isDeletingAvatar,
  };
}

/** Whether a Preferences save is in flight; until it settles, its choices are unconfirmed. */
export function usePreferencesSaving() {
  const trpc = useTRPC();

  return useIsMutating({ mutationKey: trpc.user.updatePreferences.mutationKey() }) > 0;
}

/** The Reader's account-wide Preferences, changed optimistically. */
export function usePreferencesMutation() {
  const trpc = useTRPC();
  const { held, write, mergePreferences, invalidate } = useProfileCache();
  const failed = useFailedWrite();
  const send = useVersionedSend();
  const refuseStale = useStaleRefusal();
  const saving = usePreferencesSaving();
  const context = "user-settings:update-preferences";

  type PreferencePatch = inferRouterInputs<AppRouter>["user"]["updatePreferences"]["preferences"];
  type OptimisticSave = { version: number; previous: PreferencePatch };

  const rollBack = (sent: PreferencePatch, optimistic: OptimisticSave | undefined) => {
    const current = held();

    if (!current || !optimistic || current.user.version !== optimistic.version) return;

    const shown = current.user.preferences ?? {};
    const previous = optimistic.previous;
    const undo = Object.fromEntries(
      (Object.keys(previous) as (keyof PreferencePatch)[])
        .filter((key) => shown[key] === sent[key])
        .map((key) => [key, previous[key]])
    );

    if (Object.keys(undo).length > 0)
      write((data) => ({
        ...data,
        user: { ...data.user, preferences: { ...data.user.preferences, ...undo } },
      }));
  };

  const { mutateAsync } = useMutation(
    trpc.user.updatePreferences.mutationOptions({
      onMutate: ({ preferences }): OptimisticSave | undefined => {
        const current = held();

        if (!current) return;

        const shown: PreferencePatch = current.user.preferences ?? {};
        const previous = Object.fromEntries(
          (Object.keys(preferences) as (keyof PreferencePatch)[]).map((key) => [key, shown[key]])
        );

        write((data) => ({
          ...data,
          user: { ...data.user, preferences: { ...data.user.preferences, ...preferences } },
        }));

        return { previous, version: current.user.version };
      },
      onSuccess: (answer, { preferences }, optimistic) => {
        if (!answer.success) {
          rollBack(preferences, optimistic);
          void invalidate();

          return;
        }
        if (answer.stale) refuseStale(context);
        mergePreferences(answer.preferences, answer.version);
      },
      onError: (error, { preferences }, optimistic) => {
        if (shouldPreserveOptimisticUpdate(error)) return;

        rollBack(preferences, optimistic);
        failed(context)(error);
      },
    })
  );

  return {
    /** Resolves whether the server took them; sent once every earlier profile write settled. */
    updatePreferences: (preferences: Partial<UserPreferencesDto>): Promise<boolean> =>
      acceptedFresh(send(context, (version) => mutateAsync({ preferences, version }))),
    isUpdatingPreferences: saving,
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
