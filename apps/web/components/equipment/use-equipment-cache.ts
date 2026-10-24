"use client";

import { useCallback, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import type { EquipmentItem } from "./types";

interface ListPage {
  items: EquipmentItem[];
  nextCursor: number | null;
}

type ListData = { pages: ListPage[]; pageParams: unknown[] } | ListPage;

export type EquipmentRowPatch = (item: EquipmentItem) => EquipmentItem | null;

export function useEquipmentCache() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const patchRows = useCallback(
    (patch: EquipmentRowPatch) => {
      const patchList = (items: EquipmentItem[] | undefined) =>
        Array.isArray(items)
          ? items.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const next = patch({
                ...item,
                aliases: Array.isArray(item.aliases) ? item.aliases : [],
              });

              return next === null ? [] : [next];
            })
          : [];

      const patchPage = (page: ListPage): ListPage =>
        page && Array.isArray(page.items) ? { ...page, items: patchList(page.items) } : page;

      queryClient.setQueriesData<ListData>({ queryKey: trpc.equipment.list.pathKey() }, (data) => {
        if (!data || typeof data !== "object") return data;
        if (Array.isArray(data)) return patchList(data) as unknown as ListData;
        if ("pages" in data) {
          return Array.isArray(data.pages) ? { ...data, pages: data.pages.map(patchPage) } : data;
        }

        return patchPage(data);
      });
      queryClient.setQueriesData<EquipmentItem | null>(
        { queryKey: trpc.equipment.get.pathKey() },
        (item) =>
          item && typeof item === "object"
            ? patch({
                ...item,
                aliases: Array.isArray(item.aliases) ? item.aliases : [],
              })
            : item
      );
    },
    [queryClient, trpc]
  );

  return useMemo(
    () => ({
      patchRow: (equipmentId: string, change: (item: EquipmentItem) => EquipmentItem) =>
        patchRows((item) => (item.id === equipmentId ? change(item) : item)),
      dropRow: (equipmentId: string) =>
        patchRows((item) => (item.id === equipmentId ? null : item)),
      rollback: () => queryClient.invalidateQueries({ queryKey: trpc.equipment.pathKey() }),
    }),
    [patchRows, queryClient, trpc]
  );
}
