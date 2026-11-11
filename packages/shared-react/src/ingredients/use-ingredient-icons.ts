import type { inferRouterOutputs } from "@trpc/server";
import { useSyncExternalStore } from "react";
import {
  matchQuery,
  notifyManager,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";
import { iconIds } from "@norish/shared/lib/ingredient-icon-ids";
import { uploadForm } from "@norish/shared/lib/upload-form";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { useCatalogueFailure } from "./use-catalogue-failure";

/** Each food's icon by its Ingredient's id, null where it has none: one read's answer. */
type IconAnswer = inferRouterOutputs<AppRouter>["ingredients"]["icons"];

/** One read of a surface's foods' icons; each icon selects its own with `useIngredientIconAddress`. */
export function useIngredientIcons(ids: readonly (string | null | undefined)[]): void {
  const trpc = useTRPC();
  const wanted = iconIds(ids);

  useQuery({
    ...trpc.ingredients.icons.queryOptions({ ids: wanted }),
    enabled: wanted.length > 0,
    notifyOnChangeProps: [],
  });
}

/**
 * One food's icon address from a surface's own read, else the newest earlier one that answered it,
 * so an icon keeps the previous read's while a changed set is read; undefined until one answers it.
 */
export function useIngredientIconAddress(ingredientId: string): string | null | undefined {
  const trpc = useTRPC();
  const queryCache = useQueryClient().getQueryCache();
  const subscribe = (onChange: () => void) =>
    // Batched as TanStack's observers are, so a change made during a render notifies after it.
    queryCache.subscribe(
      notifyManager.batchCalls(({ query }) => {
        if (matchQuery({ queryKey: trpc.ingredients.icons.pathKey() }, query)) onChange();
      })
    );
  const read = () => {
    let address: string | null | undefined;
    let answeredWatched = false;
    let answeredAt = -1;

    for (const query of queryCache.findAll({ queryKey: trpc.ingredients.icons.pathKey() })) {
      const answer = query.state.data as IconAnswer | undefined;
      // A read a surface watches outranks an earlier one, as a seed carries the server's clock.
      const watched = query.getObserversCount() > 0;
      const at = query.state.dataUpdatedAt;

      if (
        answer &&
        Object.hasOwn(answer, ingredientId) &&
        (watched !== answeredWatched ? watched : at > answeredAt)
      ) {
        address = answer[ingredientId];
        answeredWatched = watched;
        answeredAt = at;
      }
    }

    return address;
  };

  // A string or null, so an unchanged address renders nothing.
  return useSyncExternalStore(subscribe, read, read);
}

/** The food each name already names, or null where it names none yet. A reader: it never mints. */
export function useIngredientsNamed(names: readonly string[]): ReadonlyMap<string, string | null> {
  const trpc = useTRPC();
  const found = useQueries({
    queries: names.map((name) => ({
      ...trpc.ingredients.find.queryOptions({ name: name.slice(0, 300) }),
      staleTime: Infinity,
    })),
  });

  return new Map(names.map((name, index) => [name, found[index]?.data?.ingredientId ?? null]));
}

/** A drawn or uploaded icon, stored but not yet the food's: Save makes it so. */
export type StoredIcon = { file: string; address: string };

/** Upload a picture or generate an icon for a food; each resolves the stored icon, or null when it failed. */
export function useIngredientIconMutations(ingredientId: string) {
  const trpc = useTRPC();
  const { toast } = usePlatform();
  const { fail } = useCatalogueFailure();
  const failed = (context: string, description: string) => ({
    onError: (error: unknown) =>
      fail(
        error,
        context,
        toast.translate("settings.ingredients.errors.title"),
        toast.translate(description)
      ),
  });
  const upload = useMutation(
    trpc.ingredients.uploadIcon.mutationOptions(
      failed("upload-icon", "settings.ingredients.icon.failed")
    )
  );
  const generate = useMutation(
    trpc.ingredients.generateIcon.mutationOptions(
      failed("generate-icon", "settings.ingredients.icon.generateFailed")
    )
  );
  const stored = (write: Promise<StoredIcon>) =>
    write.then(
      ({ file, address }): StoredIcon => ({ file, address }),
      () => null
    );

  return {
    upload: (image: File) => stored(upload.mutateAsync(uploadForm({ ingredientId, image }))),
    generate: () => stored(generate.mutateAsync({ ingredientId })),
    isPending: upload.isPending || generate.isPending,
  };
}
