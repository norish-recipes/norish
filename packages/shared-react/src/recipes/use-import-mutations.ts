"use client";

import type { MutationKey } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

import { uploadForm } from "@norish/shared/lib/upload-form";

import type { RecipesMutationErrorHandler } from "./recipes-mutation-error";
import { useTRPC, useTRPCClient } from "../trpc";
import { handleRecipesMutationError } from "./recipes-mutation-error";
import { OPTIMISTIC_PENDING_RECIPE_PREFIX, useRecipesCacheHelpers } from "./use-recipes-cache";

type ImportMutationContext = {
  optimisticPendingId: string;
};

/** Told how one import ended: null once the server took it, else the error (a Queued one included). */
export type ImportSettled = (error: unknown) => void;

export type ImportOptions = {
  onSettled?: ImportSettled;
  /** Sent as the mutation's operation id, so the server runs a repeat of it once (ADR-0002). */
  operationId?: string;
  /** The errors its caller keeps the import for, to try later: they toast nothing. */
  keeps?: (error: unknown) => boolean;
  /** Called once the server queued it and its pending card shows. */
  onAccepted?: () => void;
};

type ImportMutationsResult = {
  importRecipe: (url: string, options?: ImportOptions) => void;
  importRecipeWithAI: (url: string) => void;
  /** Browser `File`s or expo-file-system `File`s, which are Blobs too. */
  importRecipeFromImages: (files: Blob[], options?: ImportOptions) => void;
  importRecipeFromPaste: (text: string, options?: ImportOptions) => void;
  importRecipeFromPasteWithAI: (text: string) => void;
};

/** One import's input and its caller's options. */
type ImportCall<Input> = Omit<ImportOptions, "onSettled"> & { input: Input };

/** Runs a mutation and reports its end; rollback and toasts stay in `useMutation`'s own options. */
function settle(run: Promise<unknown>, onSettled?: ImportSettled): void {
  void run.then(
    () => onSettled?.(null),
    (error: unknown) => onSettled?.(error)
  );
}

// The operation-id link keeps an id already in the context, and the Outbox stores it for Replay.
const withOperationId = (operationId: string | undefined) =>
  operationId ? { context: { operationId } } : undefined;

/** Told the id of a recipe the household already holds: not an error, so an app can offer it. */
type RecipeAlreadyExistsHandler = (recipeId: string) => void;

function createOptimisticPendingRecipeId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- a placeholder id needs to be unique, not unpredictable
  return `${OPTIMISTIC_PENDING_RECIPE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type ImportHandlers<Input, Output> = {
  onSuccess: (output: Output, call: ImportCall<Input>, context: ImportMutationContext) => void;
  onError: (
    error: unknown,
    call: ImportCall<Input>,
    context: ImportMutationContext | undefined
  ) => void;
};

/** One import procedure's mutation, sent under its caller's operation id behind a placeholder card. */
function useImportMutation<Input, Output>(
  procedure: { mutationKey: () => MutationKey },
  client: {
    mutate: (input: Input, options?: { context: { operationId: string } }) => Promise<Output>;
  },
  handlers: ImportHandlers<Input, Output>
) {
  const { addPendingRecipe } = useRecipesCacheHelpers();

  return useMutation({
    mutationKey: procedure.mutationKey(),
    mutationFn: ({ input, operationId }: ImportCall<Input>) =>
      client.mutate(input, withOperationId(operationId)),
    onMutate: (): ImportMutationContext => {
      const optimisticPendingId = createOptimisticPendingRecipeId();

      addPendingRecipe(optimisticPendingId);

      return { optimisticPendingId };
    },
    ...handlers,
  }).mutateAsync;
}

export function useImportMutations(
  onError?: RecipesMutationErrorHandler,
  onRecipeAlreadyExists?: RecipeAlreadyExistsHandler
): ImportMutationsResult {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const { addPendingRecipe, replacePendingRecipe, removePendingRecipe, invalidate } =
    useRecipesCacheHelpers();

  const dropPlaceholder = (context: ImportMutationContext | undefined): void => {
    if (context) removePendingRecipe(context.optimisticPendingId);
  };

  // The placeholder becomes the imported recipe; without one, the recipe is added.
  const showImported = (
    recipeId: string,
    context: ImportMutationContext | undefined,
    call: ImportCall<unknown>
  ): void => {
    call.onAccepted?.();
    if (!context) {
      addPendingRecipe(recipeId);

      return;
    }

    replacePendingRecipe(context.optimisticPendingId, recipeId);
  };

  const handleImportError = (
    error: unknown,
    operation: string,
    context: ImportMutationContext | undefined,
    call: ImportCall<unknown>
  ): void => {
    const report = call.keeps?.(error) ? undefined : onError;

    handleRecipesMutationError(error, operation, report, () => {
      dropPlaceholder(context);
      invalidate();
    });
  };

  const mutateImport = useImportMutation(trpc.recipes.importFromUrl, client.recipes.importFromUrl, {
    onSuccess: ({ recipeId, status }, call, context) => {
      // Nothing was queued, so there is no pending recipe to stand in for:
      // drop the placeholder and hand the id to whoever can offer it.
      if (status === "exists") {
        dropPlaceholder(context);
        onRecipeAlreadyExists?.(recipeId);

        return;
      }

      showImported(recipeId, context, call);
    },
    onError: (error, call, context) => {
      handleImportError(
        error,
        call.input.forceAI ? "importFromUrlWithAI" : "importFromUrl",
        context,
        call
      );
    },
  });
  const mutateImageImport = useImportMutation(
    trpc.recipes.importFromImages,
    client.recipes.importFromImages,
    {
      onSuccess: (recipeId, call, context) => {
        showImported(recipeId, context, call);
      },
      onError: (error, call, context) => {
        handleImportError(error, "importFromImages", context, call);
      },
    }
  );
  const mutatePasteImport = useImportMutation(
    trpc.recipes.importFromPaste,
    client.recipes.importFromPaste,
    {
      onSuccess: (result, call, context) => {
        const [firstRecipeId, ...remainingRecipeIds] = result.recipeIds;

        if (!firstRecipeId) {
          dropPlaceholder(context);
          invalidate();

          return;
        }

        showImported(firstRecipeId, context, call);
        remainingRecipeIds.forEach((recipeId) => addPendingRecipe(recipeId));
      },
      onError: (error, call, context) => {
        handleImportError(
          error,
          call.input.forceAI ? "importFromPasteWithAI" : "importFromPaste",
          context,
          call
        );
      },
    }
  );

  return {
    importRecipe: (url, options) =>
      settle(mutateImport({ ...options, input: { url } }), options?.onSettled),
    importRecipeWithAI: (url) => settle(mutateImport({ input: { url, forceAI: true } })),
    importRecipeFromImages: (files, options) =>
      settle(
        mutateImageImport({
          ...options,
          input: uploadForm(Object.fromEntries(files.map((file, i) => [`file${i}`, file]))),
        }),
        options?.onSettled
      ),
    importRecipeFromPaste: (text, options) =>
      settle(mutatePasteImport({ ...options, input: { text } }), options?.onSettled),
    importRecipeFromPasteWithAI: (text) =>
      settle(mutatePasteImport({ input: { text, forceAI: true } })),
  };
}
