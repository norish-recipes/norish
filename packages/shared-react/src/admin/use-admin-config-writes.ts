import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import type { WriteResult } from "./types";
import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

type AuthProvider = "oidc" | "github" | "google";

/** An `onSuccess` that, once the server took the write, reads the admin config and `also` again. */
function useReread() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (...also: QueryKey[]) =>
    (result: WriteResult) => {
      if (!result.success) return;

      for (const queryKey of [trpc.admin.getAllConfigs.queryKey(), ...also]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
}

/** Registration and the languages users choose from; the language save toasts how it went. */
export function useGeneralConfigWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const { toast, showError } = usePlatform();

  const registration = useMutation(
    trpc.admin.updateRegistration.mutationOptions({ onSuccess: reread() })
  );
  const locales = useMutation(
    trpc.admin.updateLocaleConfig.mutationOptions({
      onSuccess: (result) => {
        reread()(result);
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

  return { setRegistration: registration.mutateAsync, saveLocales: locales.mutateAsync };
}

export function usePasswordAuthWrite() {
  const trpc = useTRPC();
  const reread = useReread();

  return useMutation(trpc.admin.updatePasswordAuth.mutationOptions({ onSuccess: reread() }))
    .mutateAsync;
}

/** The OAuth providers' saves, removal and test; a refused removal says so. */
export function useAuthProviderWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const { showError } = usePlatform();

  const oidc = useMutation(trpc.admin.auth.updateOIDC.mutationOptions({ onSuccess: reread() }));
  const github = useMutation(trpc.admin.auth.updateGitHub.mutationOptions({ onSuccess: reread() }));
  const google = useMutation(trpc.admin.auth.updateGoogle.mutationOptions({ onSuccess: reread() }));
  const remove = useMutation(
    trpc.admin.auth.deleteProvider.mutationOptions({
      onSuccess: (result, type) => {
        reread()(result);
        if (!result.success) showError(result.error, `admin-auth-provider:delete:${type}`);
      },
    })
  );
  const test = useMutation(trpc.admin.auth.testProvider.mutationOptions());

  return {
    saveOIDC: oidc.mutateAsync,
    saveGitHub: github.mutateAsync,
    saveGoogle: google.mutateAsync,
    /** Resolves whether the server removed it. */
    remove: (type: AuthProvider) => remove.mutateAsync(type).then((result) => result.success),
    test: (type: AuthProvider, config: Record<string, unknown>) =>
      test.mutateAsync({ type, config }),
  };
}

/** The content detection configs; each also rereads the public config reads built from it. */
export function useContentConfigWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const timersEnabled = trpc.config.timersEnabled.queryKey();

  const indicators = useMutation(
    trpc.admin.content.updateContentIndicators.mutationOptions({
      onSuccess: reread(timersEnabled),
    })
  );
  // Every page that reads a name reads it by the units map too.
  const units = useMutation(
    trpc.admin.content.updateUnits.mutationOptions({
      onSuccess: reread(trpc.config.units.queryKey()),
    })
  );
  const ingredientWords = useMutation(
    trpc.admin.content.updateIngredientWords.mutationOptions({
      onSuccess: reread(trpc.config.ingredientWords.queryKey()),
    })
  );
  const recurrence = useMutation(
    trpc.admin.content.updateRecurrenceConfig.mutationOptions({ onSuccess: reread() })
  );
  const timerKeywords = useMutation(
    trpc.admin.content.updateTimerKeywords.mutationOptions({
      onSuccess: reread(trpc.config.timerKeywords.queryKey(), timersEnabled),
    })
  );

  return {
    saveContentIndicators: indicators.mutateAsync,
    saveUnits: units.mutateAsync,
    saveIngredientWords: ingredientWords.mutateAsync,
    saveRecurrence: recurrence.mutateAsync,
    saveTimerKeywords: timerKeywords.mutateAsync,
  };
}

/** Puts a config back to its shipped default, rereading the public read it feeds. */
export function useRestoreDefault() {
  const trpc = useTRPC();
  const reread = useReread();
  const { mutateAsync } = useMutation(
    trpc.admin.restoreDefault.mutationOptions({
      onSuccess: (result, key) =>
        reread(
          ...(key === ServerConfigKeys.UNITS ? [trpc.config.units.queryKey()] : []),
          ...(key === ServerConfigKeys.INGREDIENT_WORDS
            ? [trpc.config.ingredientWords.queryKey()]
            : [])
        )(result),
    })
  );

  return (key: ServerConfigKey) => mutateAsync(key);
}

export function useAIConfigWrite() {
  const trpc = useTRPC();
  const reread = useReread();
  const save = useMutation(trpc.admin.updateAIConfig.mutationOptions({ onSuccess: reread() }));
  const test = useMutation(trpc.admin.testAIEndpoint.mutationOptions());

  return { save: save.mutateAsync, test: test.mutateAsync };
}

export function useVideoConfigWrite() {
  const trpc = useTRPC();
  const reread = useReread();

  return useMutation(trpc.admin.updateVideoConfig.mutationOptions({ onSuccess: reread() }))
    .mutateAsync;
}

export function useImageGenerationConfigWrite() {
  const trpc = useTRPC();
  const reread = useReread();

  return useMutation(
    trpc.admin.updateImageGenerationConfig.mutationOptions({ onSuccess: reread() })
  ).mutateAsync;
}

export function useDecisionConfigWrite() {
  const trpc = useTRPC();
  const reread = useReread();
  const save = useMutation(
    trpc.admin.updateDecisionConfig.mutationOptions({ onSuccess: reread() })
  );
  const test = useMutation(trpc.admin.testDecisionEndpoint.mutationOptions());

  return { save: save.mutateAsync, test: test.mutateAsync };
}

export function usePromptsWrite() {
  const trpc = useTRPC();
  const reread = useReread();

  return useMutation(trpc.admin.content.updatePrompts.mutationOptions({ onSuccess: reread() }))
    .mutateAsync;
}

export function usePermissionPolicyWrites() {
  const trpc = useTRPC();
  const reread = useReread();
  const recipes = useMutation(
    trpc.admin.updateRecipePermissionPolicy.mutationOptions({ onSuccess: reread() })
  );
  const ingredients = useMutation(
    trpc.admin.updateIngredientPermissionPolicy.mutationOptions({ onSuccess: reread() })
  );

  return { saveRecipePolicy: recipes.mutateAsync, saveIngredientPolicy: ingredients.mutateAsync };
}

export function useSchedulerMonthsWrite() {
  const trpc = useTRPC();
  const reread = useReread();

  return useMutation(trpc.admin.updateSchedulerMonths.mutationOptions({ onSuccess: reread() }))
    .mutateAsync;
}

/** Resolves whether the server agreed to restart. */
export function useRestartServer() {
  const trpc = useTRPC();
  const { mutateAsync } = useMutation(trpc.admin.restartServer.mutationOptions());

  return () => wentThrough(mutateAsync());
}
