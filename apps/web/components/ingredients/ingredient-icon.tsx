"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useSyncExternalStore } from "react";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import {
  matchQuery,
  notifyManager,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";

import type { AppRouter } from "@norish/trpc/client";
import { useTRPC } from "@norish/shared-react/trpc";
import { addBasePath } from "@norish/shared/lib/base-path";
import { iconIds } from "@norish/shared/lib/ingredient-icon-ids";

/**
 * The sizes an Ingredient Icon is shown at: beside a step's chip, a line or
 * a row (smaller on a phone, where every pixel beside a line wraps it), and
 * in its panel.
 */
const SIZES = { chip: "size-5", line: "size-6 md:size-8", panel: "size-16" } as const;

export type IngredientIconSize = keyof typeof SIZES;

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

/** Each food's icon by its Ingredient's id, null where it has none: one read's answer. */
type IconAnswer = inferRouterOutputs<AppRouter>["ingredients"]["icons"];

/** One read of a surface's foods' icons; each `IngredientIcon` selects its own from the cache. */
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
function useCachedIconAddress(ingredientId: string): string | null | undefined {
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

/**
 * The food each typed name already names, by the name, or null where it
 * names none yet: what an editor row shows the icon of as soon as Norish
 * knows what was typed. A reader: it never mints. Names are looked up once
 * typing pauses; a name not looked up yet answers nothing.
 */
export function useFoodsByName(names: readonly string[]): ReadonlyMap<string, string | null> {
  const trpc = useTRPC();
  const [typed] = useDebounceValue(
    [...new Set(names.filter((name) => name !== ""))].join("\n"),
    FIND_DELAY_MS
  );
  const looked = typed ? typed.split("\n") : [];
  const found = useQueries({
    queries: looked.map((name) => ({
      ...trpc.ingredients.find.queryOptions({ name: name.slice(0, 300) }),
      staleTime: Infinity,
    })),
  });

  return new Map(looked.map((name, index) => [name, found[index]?.data?.ingredientId ?? null]));
}

/**
 * An Ingredient Icon: a small picture of the food standing on nothing,
 * decoration beside its name and never in place of it. A food with no icon
 * anywhere shows nothing, nor does a line whose food the server has not
 * resolved yet; only while the surface's read is on its way does it hold an
 * empty slot, so the line does not jump when the icon lands. `placeholder`
 * shows a muted leaf on the icon's tile instead of nothing, for the
 * Ingredients list and the panel field an icon is set in. A reader who hid
 * icons gets none of these. A heading is not a food and
 * is given no icon at all. `src` is the address outright, where a surface has
 * it (the share page exposes no ids); otherwise the surface's read is looked
 * up by `ingredientId`.
 */
export function IngredientIcon({
  ingredientId,
  src,
  ...shown
}: {
  ingredientId?: string | null;
  src?: string | null;
} & Shown) {
  const { showIngredientIcons } = useHiddenItemVisibility();

  if (!showIngredientIcons) return null;
  // A line whose food the server has not resolved yet reads nothing and shows nothing.
  if (src !== undefined || !ingredientId) {
    return <IconPicture address={src ?? null} reading={false} {...shown} />;
  }

  return <CachedIngredientIcon ingredientId={ingredientId} {...shown} />;
}

type Shown = { size?: IngredientIconSize; placeholder?: boolean; className?: string };

/** An icon looked up by its food in the surface's read, holding its slot until that answers. */
function CachedIngredientIcon({ ingredientId, ...shown }: { ingredientId: string } & Shown) {
  const address = useCachedIconAddress(ingredientId);

  return <IconPicture address={address ?? null} reading={address === undefined} {...shown} />;
}

function IconPicture({
  address,
  reading,
  size = "line",
  placeholder = false,
  className = "",
}: { address: string | null; reading: boolean } & Shown) {
  if (!address) {
    if (placeholder) {
      return (
        <span
          aria-hidden
          className={`bg-surface-secondary text-muted flex shrink-0 items-center justify-center rounded-[30%] ${SIZES[size]} ${className}`}
          data-testid="ingredient-icon-placeholder"
        >
          <svg
            className="size-1/2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path d="M5 19C5 10.5 10 5 19 5c0 9-5.5 14-14 14Z" />
            <path d="M5 19l8-8" />
          </svg>
        </span>
      );
    }
    if (!reading) return null;

    return <span aria-hidden className={`block shrink-0 ${SIZES[size]} ${className}`} />;
  }

  return (
    <img
      aria-hidden
      alt=""
      className={`block shrink-0 object-contain ${SIZES[size]} ${className}`}
      data-testid="ingredient-icon"
      decoding="async"
      loading="lazy"
      src={addBasePath(address)}
    />
  );
}
