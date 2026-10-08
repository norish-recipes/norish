"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useDevicePreference } from "@/context/device-preferences-context";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";

/**
 * The sizes an Ingredient Icon is shown at: beside a step's chip, a line or
 * a row (smaller on a phone, where every pixel beside a line wraps it), and
 * in its panel.
 */
const SIZES = { chip: "size-5", line: "size-6 md:size-8", panel: "size-16" } as const;

export type IngredientIconSize = keyof typeof SIZES;

/** How many foods one read asks about: the procedure's own limit. */
const MAX_IDS = 500;

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

interface IconsOnSurface {
  /** Each food's icon by its Ingredient's id; null where it has none. */
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
    // ponytail: a surface past 500 foods shows no icons beyond them; page the read if one ever does.
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
  const hidden = useDevicePreference("hiddenItems")[0].includes("ingredientIcons");
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
 * anywhere shows nothing, nor does a line whose food the server has not
 * resolved yet; only while the surface's read is on its way does it hold an
 * empty slot, so the line does not jump when the icon lands. `placeholder`
 * shows a muted square instead of nothing, for the panel field an icon is set
 * in. A reader who hid icons gets none of these. A heading is not a food and
 * is given no icon at all. `src` is the address outright, where a surface has
 * it (the share page exposes no ids); otherwise the surface's read is looked
 * up by `ingredientId`.
 */
export function IngredientIcon({
  ingredientId,
  src,
  size = "line",
  placeholder = false,
  className = "",
}: {
  ingredientId?: string | null;
  src?: string | null;
  size?: IngredientIconSize;
  placeholder?: boolean;
  className?: string;
}) {
  const { addresses, hidden } = useContext(IconsContext);

  if (hidden) return null;

  const address = src !== undefined ? src : ingredientId ? (addresses[ingredientId] ?? null) : null;
  const reading = src === undefined && ingredientId != null && !(ingredientId in addresses);

  if (!address) {
    if (!placeholder && !reading) return null;

    return (
      <span
        aria-hidden
        className={`block shrink-0 ${placeholder ? "bg-surface-secondary rounded-[30%] opacity-60" : ""} ${SIZES[size]} ${className}`}
        data-testid={placeholder ? "ingredient-icon-placeholder" : undefined}
      />
    );
  }

  return (
    <img
      aria-hidden
      alt=""
      className={`block shrink-0 object-contain ${SIZES[size]} ${className}`}
      data-testid="ingredient-icon"
      decoding="async"
      loading="lazy"
      src={address}
    />
  );
}
