"use client";

import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";

const SIZES = { chip: "size-5", line: "size-6 md:size-8", panel: "size-16" } as const;

export type EquipmentIconSize = keyof typeof SIZES;

const MAX_IDS = 500;
const FIND_DELAY_MS = 400;

interface IconsOnSurface {
  addresses: Readonly<Record<string, string | null>>;
}

const IconsContext = createContext<IconsOnSurface>({ addresses: {} });

const NO_ICONS: Readonly<Record<string, string | null>> = {};

export function useEquipmentIcons(
  ids: readonly (string | null | undefined)[]
): Readonly<Record<string, string | null>> {
  const trpc = useTRPC();
  const key = ids.filter(Boolean).join(",");
  const wanted = useMemo(
    () =>
      [...new Set(key ? key.split(",") : [])].sort((a, b) => a.localeCompare(b)).slice(0, MAX_IDS),
    [key]
  );
  const { data } = useQuery({
    ...trpc.equipment.icons.queryOptions({ ids: wanted }),
    enabled: wanted.length > 0,
    placeholderData: keepPreviousData,
  });

  return data ?? NO_ICONS;
}

export function useEquipmentByName(names: readonly string[]): ReadonlyMap<string, string | null> {
  const trpc = useTRPC();
  const [typed] = useDebounceValue(
    [...new Set(names.filter((name) => name !== ""))].join("\n"),
    FIND_DELAY_MS
  );
  const looked = typed ? typed.split("\n") : [];
  const found = useQueries({
    queries: looked.map((name) => ({
      ...trpc.equipment.find.queryOptions({ name: name.slice(0, 300) }),
      staleTime: Infinity,
    })),
  });

  return new Map(looked.map((name, index) => [name, found[index]?.data?.equipmentId ?? null]));
}

export function EquipmentIconsProvider({
  ids = [],
  children,
}: {
  ids?: readonly (string | null | undefined)[];
  children: ReactNode;
}) {
  const addresses = useEquipmentIcons(ids);
  const value = useMemo(() => ({ addresses }), [addresses]);

  return <IconsContext value={value}>{children}</IconsContext>;
}

export function EquipmentIcon({
  equipmentId,
  src,
  size = "line",
  placeholder = false,
  className = "",
}: {
  equipmentId?: string | null;
  src?: string | null;
  size?: EquipmentIconSize;
  placeholder?: boolean;
  className?: string;
}) {
  const { addresses } = use(IconsContext);

  const address = src !== undefined ? src : equipmentId ? (addresses[equipmentId] ?? null) : null;

  if (!address) {
    if (!placeholder) return null;

    return (
      <span
        aria-hidden
        className={`bg-surface-secondary block shrink-0 rounded-[30%] opacity-60 ${SIZES[size]} ${className}`}
        data-testid="equipment-icon-placeholder"
      />
    );
  }

  return (
    <img
      aria-hidden
      alt=""
      className={`block shrink-0 object-contain ${SIZES[size]} ${className}`}
      data-testid="equipment-icon"
      decoding="async"
      loading="lazy"
      src={address}
    />
  );
}
