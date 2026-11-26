import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";

import { iconIds } from "@norish/shared/lib/ingredient-icon-ids";
import { uploadForm } from "@norish/shared/lib/upload-form";

import type { StoredIcon } from "./types";
import { answered } from "../offline/settled";
import { useTRPC } from "../trpc";
import { useCachedAnswers } from "./cached-answers";
import { useCatalogueFailure } from "./use-catalogue-failure";

/**
 * One read of a surface's foods' icons; each icon selects its own with `useIngredientIconAddress`.
 * A recipe's page passes the recipe, so its own foods show though another household's.
 */
export function useIngredientIcons(
  ids: readonly (string | null | undefined)[],
  recipeId?: string
): void {
  const trpc = useTRPC();
  const wanted = iconIds(ids);

  useQuery({
    ...trpc.ingredients.icons.queryOptions({ ids: wanted, recipeId }),
    enabled: wanted.length > 0,
    notifyOnChangeProps: [],
  });
}

/** The icon answers cached by every surface. */
function useIconAnswers() {
  const trpc = useTRPC();

  return useCachedAnswers<string | null>(trpc.ingredients.icons.pathKey());
}

/** One food's icon address from a surface's own read, else the newest earlier read that answered
 * it, so a changed set keeps the previous icon while it loads; undefined until one answers. */
export function useIngredientIconAddress(ingredientId: string): string | null | undefined {
  const { subscribe, read } = useIconAnswers();

  // A string or null, so an unchanged address renders nothing.
  const address = () => read(ingredientId)?.value;

  return useSyncExternalStore(subscribe, address, address);
}

/** Whether any food of a list has an icon: only then does a food without one keep an empty slot. */
export function useListHasIcon(ids: readonly (string | null | undefined)[]): boolean {
  const { subscribe, read } = useIconAnswers();
  const any = () => ids.some((id) => Boolean(id && read(id)?.value));

  return useSyncExternalStore(subscribe, any, any);
}

const MISS_STALE_MS = 5 * 60_000;

/** The food each name already names, or null where it names none yet. A reader: it never mints. */
export function useIngredientsNamed(names: readonly string[]): ReadonlyMap<string, string | null> {
  const trpc = useTRPC();
  const found = useQueries({
    queries: names.map((name) => ({
      ...trpc.ingredients.find.queryOptions({ name: name.slice(0, 300) }),
      // A found food goes stale only through the catalogue's subscription; a mint announces nothing.
      staleTime: (query: { state: { data?: { ingredientId: string } | null } }) =>
        query.state.data ? Infinity : MISS_STALE_MS,
    })),
  });

  return new Map(names.map((name, index) => [name, found[index]?.data?.ingredientId ?? null]));
}

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

/** The food each typed name names, or null, looked up once typing pauses; it never mints. */
export function useFoodsByName(names: readonly string[]): ReadonlyMap<string, string | null> {
  const key = [...new Set(names.filter((name) => name !== ""))].join("\n");
  const [typed, setTyped] = useState(key);

  useEffect(() => {
    const timer = setTimeout(() => setTyped(key), FIND_DELAY_MS);

    return () => clearTimeout(timer);
  }, [key]);

  return useIngredientsNamed(typed ? typed.split("\n") : []);
}

/** Upload a picture or generate an icon for a food; each resolves the stored icon, or null when it failed. */
export function useIngredientIconMutations(ingredientId: string) {
  const trpc = useTRPC();
  const { fail } = useCatalogueFailure();
  const failed = (context: string, description: string) => ({
    onError: (error: unknown) => fail(error, context, description),
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
    answered(write.then(({ file, address }): StoredIcon => ({ file, address })));

  return {
    upload: (image: File) => stored(upload.mutateAsync(uploadForm({ ingredientId, image }))),
    generate: () => stored(generate.mutateAsync({ ingredientId })),
    isPending: upload.isPending || generate.isPending,
  };
}
