import type { QueryKey, UseMutationOptions } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import type { AuthProvider, WriteResult } from "./types";
import { accepted, wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** Reads the admin config and `also` again, once the server took the write. */
function useReread() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (result: WriteResult, also: QueryKey[] = []) => {
    if (!result.success) return;

    for (const queryKey of [trpc.admin.getAllConfigs.queryKey(), ...also]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}

/** A procedure's config write, rereading the admin config and `also` once the server took it. */
function useConfigWrite<TData extends WriteResult, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>,
  also: QueryKey[] = []
) {
  const reread = useReread();

  return useMutation({ ...options, onSuccess: (result) => reread(result, also) }).mutateAsync;
}

/** A config's save and its endpoint test; the test rereads nothing. */
function useSaveAndTest<TData extends WriteResult, TError, TVariables, TTested, TTestError, TTest>(
  save: UseMutationOptions<TData, TError, TVariables>,
  test: UseMutationOptions<TTested, TTestError, TTest>
) {
  return { save: useConfigWrite(save), test: useMutation(test).mutateAsync };
}

/** Registration and the languages users choose from; the language save toasts how it went. */
export function useGeneralConfigWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const { toast, showError } = usePlatform();

  const setRegistration = useConfigWrite(trpc.admin.updateRegistration.mutationOptions());
  const locales = useMutation(
    trpc.admin.updateLocaleConfig.mutationOptions({
      onSuccess: (result) => {
        reread(result);
        if (result.success) {
          toast.show({
            severity: "success",
            title: toast.translate("settings.admin.toasts.localesSaved"),
          });
        } else {
          showError(
            result.error,
            "admin-general:save-locales",
            toast.translate("settings.admin.toasts.localesError")
          );
        }
      },
    })
  );

  return { setRegistration, saveLocales: locales.mutateAsync };
}

export function usePasswordAuthWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.updatePasswordAuth.mutationOptions());
}

/** The OAuth providers' saves, removal and test; a refused removal says so. */
export function useAuthProviderWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const { showError } = usePlatform();

  const saveOIDC = useConfigWrite(trpc.admin.auth.updateOIDC.mutationOptions());
  const saveGitHub = useConfigWrite(trpc.admin.auth.updateGitHub.mutationOptions());
  const saveGoogle = useConfigWrite(trpc.admin.auth.updateGoogle.mutationOptions());
  const remove = useMutation(
    trpc.admin.auth.deleteProvider.mutationOptions({
      onSuccess: (result, type) => {
        reread(result);
        if (!result.success) showError(result.error, `admin-auth-provider:delete:${type}`);
      },
    })
  );
  const test = useMutation(trpc.admin.auth.testProvider.mutationOptions());

  return {
    saveOIDC,
    saveGitHub,
    saveGoogle,
    /** Resolves whether the server removed it. */
    remove: (type: AuthProvider) => accepted(remove.mutateAsync(type)),
    test: (type: AuthProvider, config: Record<string, unknown>) =>
      test.mutateAsync({ type, config }),
  };
}

/** The content detection configs; each also rereads the public config reads built from it. */
export function useContentConfigWrites() {
  const trpc = useTRPC();
  const timersEnabled = trpc.config.timersEnabled.queryKey();

  return {
    saveContentIndicators: useConfigWrite(
      trpc.admin.content.updateContentIndicators.mutationOptions(),
      [timersEnabled]
    ),
    // Every page that reads a name reads it by the units map too.
    saveUnits: useConfigWrite(trpc.admin.content.updateUnits.mutationOptions(), [
      trpc.config.units.queryKey(),
    ]),
    saveIngredientWords: useConfigWrite(
      trpc.admin.content.updateIngredientWords.mutationOptions(),
      [trpc.config.ingredientWords.queryKey()]
    ),
    saveRecurrence: useConfigWrite(trpc.admin.content.updateRecurrenceConfig.mutationOptions()),
    saveTimerKeywords: useConfigWrite(trpc.admin.content.updateTimerKeywords.mutationOptions(), [
      trpc.config.timerKeywords.queryKey(),
      timersEnabled,
    ]),
  };
}

/** Puts a config back to its shipped default, rereading the public read it feeds. */
export function useRestoreDefault() {
  const trpc = useTRPC();
  const reread = useReread();
  const { mutateAsync } = useMutation(
    trpc.admin.restoreDefault.mutationOptions({
      onSuccess: (result, key) =>
        reread(result, [
          ...(key === ServerConfigKeys.UNITS ? [trpc.config.units.queryKey()] : []),
          ...(key === ServerConfigKeys.INGREDIENT_WORDS
            ? [trpc.config.ingredientWords.queryKey()]
            : []),
        ]),
    })
  );

  return (key: ServerConfigKey) => mutateAsync(key);
}

export function useAIConfigWrite() {
  const trpc = useTRPC();

  return useSaveAndTest(
    trpc.admin.updateAIConfig.mutationOptions(),
    trpc.admin.testAIEndpoint.mutationOptions()
  );
}

export function useVideoConfigWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.updateVideoConfig.mutationOptions());
}

export function useImageGenerationConfigWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.updateImageGenerationConfig.mutationOptions());
}

export function useDecisionConfigWrite() {
  const trpc = useTRPC();

  return useSaveAndTest(
    trpc.admin.updateDecisionConfig.mutationOptions(),
    trpc.admin.testDecisionEndpoint.mutationOptions()
  );
}

export function usePromptsWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.content.updatePrompts.mutationOptions());
}

export function usePermissionPolicyWrites() {
  const trpc = useTRPC();

  return {
    saveRecipePolicy: useConfigWrite(trpc.admin.updateRecipePermissionPolicy.mutationOptions()),
    saveIngredientPolicy: useConfigWrite(
      trpc.admin.updateIngredientPermissionPolicy.mutationOptions()
    ),
  };
}

export function useSchedulerMonthsWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.updateSchedulerMonths.mutationOptions());
}

/** Resolves whether the server agreed to restart. */
export function useRestartServer() {
  const trpc = useTRPC();
  const { showError } = usePlatform();
  const { mutateAsync } = useMutation(
    trpc.admin.restartServer.mutationOptions({
      onError: (error) => showError(error, "admin-system:restart"),
    })
  );

  return () => wentThrough(mutateAsync());
}
