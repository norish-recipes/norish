import type { QueryKey, UseMutationOptions } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import type { AuthProvider, WriteResult } from "./types";
import { accepted, answered, wentThrough } from "../offline/settled";
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

/** A write that shows its own failure and resolves its answer, or null when the request failed. */
function useAnsweredWrite<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>,
  context: string
) {
  const { showError } = usePlatform();
  const { mutateAsync } = useMutation({
    ...options,
    onError: (error) => showError(error, context),
  });

  return (variables: TVariables) => answered(mutateAsync(variables));
}

/** A procedure's config write, rereading the admin config and `also` once the server took it. */
function useConfigWrite<TData extends WriteResult, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>,
  context: string,
  also: QueryKey[] = []
) {
  const reread = useReread();

  return useAnsweredWrite({ ...options, onSuccess: (result) => reread(result, also) }, context);
}

/** A config's save and its endpoint test; the test rereads nothing. */
function useSaveAndTest<TData extends WriteResult, TError, TVariables, TTested, TTestError, TTest>(
  save: UseMutationOptions<TData, TError, TVariables>,
  test: UseMutationOptions<TTested, TTestError, TTest>,
  context: string
) {
  return {
    save: useConfigWrite(save, `${context}:save`),
    test: useAnsweredWrite(test, `${context}:test`),
  };
}

/** Registration and the languages users choose from; the language save toasts how it went. */
export function useGeneralConfigWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const { toast, showError } = usePlatform();

  const setRegistration = useConfigWrite(
    trpc.admin.updateRegistration.mutationOptions(),
    "admin-general:registration"
  );
  const saveLocales = useAnsweredWrite(
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
    }),
    "admin-general:save-locales"
  );

  return { setRegistration, saveLocales };
}

export function usePasswordAuthWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.updatePasswordAuth.mutationOptions(), "admin-auth:password");
}

/** The OAuth providers' saves, removal and test; a refused removal says so. */
export function useAuthProviderWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const { showError } = usePlatform();

  const saveOIDC = useConfigWrite(
    trpc.admin.auth.updateOIDC.mutationOptions(),
    "admin-auth-provider:save:oidc"
  );
  const saveGitHub = useConfigWrite(
    trpc.admin.auth.updateGitHub.mutationOptions(),
    "admin-auth-provider:save:github"
  );
  const saveGoogle = useConfigWrite(
    trpc.admin.auth.updateGoogle.mutationOptions(),
    "admin-auth-provider:save:google"
  );
  const remove = useMutation(
    trpc.admin.auth.deleteProvider.mutationOptions({
      onSuccess: (result, type) => {
        reread(result);
        if (!result.success) showError(result.error, `admin-auth-provider:delete:${type}`);
      },
      onError: (error, type) => showError(error, `admin-auth-provider:delete:${type}`),
    })
  );
  const test = useAnsweredWrite(
    trpc.admin.auth.testProvider.mutationOptions(),
    "admin-auth-provider:test"
  );

  return {
    saveOIDC,
    saveGitHub,
    saveGoogle,
    /** Resolves whether the server removed it. */
    remove: (type: AuthProvider) => accepted(remove.mutateAsync(type)),
    test: (type: AuthProvider, config: Record<string, unknown>) => test({ type, config }),
  };
}

/** The content detection configs; each also rereads the public config reads built from it. */
export function useContentConfigWrites() {
  const trpc = useTRPC();
  const timersEnabled = trpc.config.timersEnabled.queryKey();

  return {
    saveContentIndicators: useConfigWrite(
      trpc.admin.content.updateContentIndicators.mutationOptions(),
      "admin-content:content-indicators",
      [timersEnabled]
    ),
    // Every page that reads a name reads it by the units map too.
    saveUnits: useConfigWrite(
      trpc.admin.content.updateUnits.mutationOptions(),
      "admin-content:units",
      [trpc.config.units.queryKey()]
    ),
    saveIngredientWords: useConfigWrite(
      trpc.admin.content.updateIngredientWords.mutationOptions(),
      "admin-content:ingredient-words",
      [trpc.config.ingredientWords.queryKey()]
    ),
    saveRecurrence: useConfigWrite(
      trpc.admin.content.updateRecurrenceConfig.mutationOptions(),
      "admin-content:recurrence"
    ),
    saveTimerKeywords: useConfigWrite(
      trpc.admin.content.updateTimerKeywords.mutationOptions(),
      "admin-content:timer-keywords",
      [trpc.config.timerKeywords.queryKey(), timersEnabled]
    ),
  };
}

/** Puts a config back to its shipped default, rereading the public read it feeds. */
export function useRestoreDefault() {
  const trpc = useTRPC();
  const reread = useReread();
  return useAnsweredWrite(
    trpc.admin.restoreDefault.mutationOptions({
      onSuccess: (result, key: ServerConfigKey) =>
        reread(result, [
          ...(key === ServerConfigKeys.UNITS ? [trpc.config.units.queryKey()] : []),
          ...(key === ServerConfigKeys.INGREDIENT_WORDS
            ? [trpc.config.ingredientWords.queryKey()]
            : []),
        ]),
    }),
    "admin-config:restore-default"
  );
}

export function useAIConfigWrite() {
  const trpc = useTRPC();

  return useSaveAndTest(
    trpc.admin.updateAIConfig.mutationOptions(),
    trpc.admin.testAIEndpoint.mutationOptions(),
    "admin-ai"
  );
}

export function useVideoConfigWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.updateVideoConfig.mutationOptions(), "admin-video:save");
}

export function useImageGenerationConfigWrite() {
  const trpc = useTRPC();

  return useConfigWrite(
    trpc.admin.updateImageGenerationConfig.mutationOptions(),
    "admin-image-generation:save"
  );
}

export function useDecisionConfigWrite() {
  const trpc = useTRPC();

  return useSaveAndTest(
    trpc.admin.updateDecisionConfig.mutationOptions(),
    trpc.admin.testDecisionEndpoint.mutationOptions(),
    "admin-decision"
  );
}

export function usePromptsWrite() {
  const trpc = useTRPC();

  return useConfigWrite(trpc.admin.content.updatePrompts.mutationOptions(), "admin-prompts:save");
}

export function usePermissionPolicyWrites() {
  const trpc = useTRPC();

  return {
    saveRecipePolicy: useConfigWrite(
      trpc.admin.updateRecipePermissionPolicy.mutationOptions(),
      "admin-permissions:recipes"
    ),
    saveIngredientPolicy: useConfigWrite(
      trpc.admin.updateIngredientPermissionPolicy.mutationOptions(),
      "admin-permissions:ingredients"
    ),
  };
}

export function useSchedulerMonthsWrite() {
  const trpc = useTRPC();

  return useConfigWrite(
    trpc.admin.updateSchedulerMonths.mutationOptions(),
    "admin-system:scheduler-months"
  );
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
