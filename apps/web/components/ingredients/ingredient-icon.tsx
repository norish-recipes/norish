"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useHiddenItems } from "@/context/hidden-items-context";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";

/** The sizes an Ingredient Icon is shown at: beside a step's chip, a line or a row, and in its panel. */
const SIZES = { chip: 20, line: 32, panel: 64 } as const;

export type IngredientIconSize = keyof typeof SIZES;

/** How many foods one read asks about: the procedure's own limit. */
const MAX_IDS = 500;

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

interface IconsOnSurface {
  /** Each food's icon by its Ingredient's id; null shows the placeholder. */
  addresses: Readonly<Record<string, string | null>>;
  /** The reader hid Ingredient Icons on this device. */
  hidden: boolean;
}

const IconsContext = createContext<IconsOnSurface>({ addresses: {}, hidden: false });

const NO_ICONS: Readonly<Record<string, string | null>> = {};

/**
 * The icons of the foods a surface shows, read once for them all: a recipe's
 * lines, a grocery list, the Pantry. The answer is kept with the rest of the
 * query cache, so a list opened offline shows the icons it showed before, and
 * any change to the catalogue reads it again. The previous answer stays on
 * screen while a changed set of foods is read, so adding a row never blanks
 * the others.
 */
export function useIngredientIcons(
  ids: readonly (string | null | undefined)[]
): Readonly<Record<string, string | null>> {
  const trpc = useTRPC();
  const key = ids.filter(Boolean).join(",");
  const wanted = useMemo(
    // ponytail: a surface past 500 foods shows placeholders beyond them; page the read if one ever does.
    () => [...new Set(key ? key.split(",") : [])].sort().slice(0, MAX_IDS),
    [key]
  );
  const { data } = useQuery({
    ...trpc.ingredients.icons.queryOptions({ ids: wanted }),
    enabled: wanted.length > 0,
    placeholderData: keepPreviousData,
  });

  return data ?? NO_ICONS;
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
 * Where a surface's icons come from: the foods it shows (`ids`), read in one
 * go, and whether the reader hid Ingredient Icons. Every `IngredientIcon`
 * below reads it; one given its address outright needs only the latter.
 */
export function IngredientIconsProvider({
  ids = [],
  children,
}: {
  ids?: readonly (string | null | undefined)[];
  children: ReactNode;
}) {
  const addresses = useIngredientIcons(ids);
  const hidden = useHiddenItems().includes("ingredientIcons");
  const value = useMemo(() => ({ addresses, hidden }), [addresses, hidden]);

  return <IconsContext.Provider value={value}>{children}</IconsContext.Provider>;
}

/** Whether the reader hid Ingredient Icons, as the surface's provider read it; false outside one. */
export function useIngredientIconsHidden(): boolean {
  return useContext(IconsContext).hidden;
}

/**
 * An Ingredient Icon: a small picture of the food standing on nothing,
 * decoration beside its name and never in place of it. A food with no icon
 * anywhere shows a muted placeholder of the same size, so a column of lines
 * keeps its alignment; a reader who hid icons gets neither, nor the slot. A
 * heading is not a food and is given no icon at all. `src` is the address
 * outright, where a surface has it (the share page exposes no ids);
 * otherwise the surface's read is looked up by `ingredientId`, and a line
 * whose food the server has not resolved yet shows the placeholder.
 */
export function IngredientIcon({
  ingredientId,
  src,
  size = "line",
  className = "",
}: {
  ingredientId?: string | null;
  src?: string | null;
  size?: IngredientIconSize;
  className?: string;
}) {
  const { addresses, hidden } = useContext(IconsContext);

  if (hidden) return null;

  const address = src !== undefined ? src : ingredientId ? (addresses[ingredientId] ?? null) : null;
  const px = SIZES[size];

  if (!address) {
    return (
      <span
        aria-hidden
        className={`bg-surface-secondary block shrink-0 rounded-full opacity-60 ${className}`}
        data-testid="ingredient-icon-placeholder"
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <img
      aria-hidden
      alt=""
      className={`block shrink-0 object-contain ${className}`}
      data-testid="ingredient-icon"
      decoding="async"
      height={px}
      loading="lazy"
      src={address}
      width={px}
    />
  );
}
