"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PackSizeDto, StoreProductChoice } from "@norish/shared/contracts";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** Writes the picker's choice on Save or Add; a refusal toasts, and the prices are reread. */
export function useChooseProduct() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const { mutate } = useMutation(
    trpc.stores.chooseProduct.mutationOptions({
      onError: (error) => showError(error, "stores:chooseProduct"),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.stores.groceryPrices.queryKey() }),
    })
  );

  return (storeId: string, name: string, choice: StoreProductChoice, pack?: PackSizeDto | null) =>
    mutate({ storeId, name, choice, ...(pack === undefined ? {} : { pack }) });
}
