"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { PackSizeDto, StoreProductChoice } from "@norish/shared/contracts";

/**
 * Write what the picker decided. Nothing calls this until the grocery panel's
 * own Save or Add: tapping around in a picker never changes what the
 * household sees. The panel has closed by the time the server answers, so a
 * refusal is told to the shopper the way every other failed write is — a
 * price that never appears with no word about why is not an outcome.
 */
export function useChooseProduct() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tErrors = useTranslations("common.errors");
  const mutation = useMutation(trpc.stores.chooseProduct.mutationOptions());
  const pricesKey = trpc.stores.groceryPrices.queryKey();

  return (
    storeId: string,
    name: string,
    choice: StoreProductChoice,
    pack?: PackSizeDto | null
  ) =>
    mutation
      .mutateAsync({ storeId, name, choice, ...(pack === undefined ? {} : { pack }) })
      .then(() => queryClient.invalidateQueries({ queryKey: pricesKey }))
      .catch((error: unknown) => {
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          error,
          context: "stores:chooseProduct",
        });

        return queryClient.invalidateQueries({ queryKey: pricesKey });
      });
}
