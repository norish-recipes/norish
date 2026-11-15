"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  ResolvedProductLink,
  StoreProductChoice,
  StoreProductDto,
} from "@norish/shared/contracts";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** The product a choice will resolve to, where this screen can tell; undefined where it can't. */
function chosenProduct(
  storeId: string,
  choice: StoreProductChoice,
  known: StoreProductDto[]
): StoreProductDto | null | undefined {
  if (choice.kind === "none") return null;
  if (choice.kind === "product") return known.find((p) => p.id === choice.storeProductId);
  const manual = choice.kind === "manual";
  const typed = manual ? choice : choice.candidate;

  return {
    id: (manual ? choice.id : undefined) ?? createClientId(),
    storeId,
    name: typed.name,
    pageUrl: manual ? (choice.pageUrl ?? null) : choice.candidate.url,
    price: typed.price,
    currency: typed.currency,
    size: typed.size ?? null,
    packQuantity: typed.pack?.quantity ?? null,
    packUnit: typed.pack?.unit ?? null,
    packByWeight: typed.pack?.byWeight ?? false,
    packByHand: false,
    regularPrice: typed.regularPrice ?? null,
    dealWords: typed.dealWords ?? null,
    pricedAt: new Date(),
    isManual: manual,
    version: 1,
  };
}

/** The prices as they were before each choice's optimistic write, keyed by the input sent. */
const pricesBefore = new WeakMap<object, ResolvedProductLink[]>();

/** Writes the picker's choice on Save or Add, priced on the list at once; a refusal puts it back and toasts. */
export function useChooseProduct() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const pricesKey = trpc.stores.groceryPrices.queryKey();
  const reread = () => void queryClient.invalidateQueries({ queryKey: pricesKey });
  const { mutate } = useMutation(
    trpc.stores.chooseProduct.mutationOptions({
      onSuccess: reread,
      onError: (error, input) => {
        if (shouldPreserveOptimisticUpdate(error)) return;
        const was = pricesBefore.get(input);

        if (was) queryClient.setQueryData(pricesKey, was);
        showError(error, "stores:chooseProduct");
        reread();
      },
    })
  );

  return (
    storeId: string,
    name: string,
    choice: StoreProductChoice,
    ingredientId?: string | null
  ) => {
    const was = queryClient.getQueryData<ResolvedProductLink[]>(pricesKey);
    // A known product is read from what this screen holds: the Store's products or the list's.
    const known = [
      ...(queryClient.getQueryData<StoreProductDto[]>(
        trpc.stores.listProducts.queryKey({ storeId })
      ) ?? []),
      ...(was ?? []).flatMap((link) => (link.product ? [link.product] : [])),
    ];
    const product = chosenProduct(storeId, choice, known);

    // A line added offline has no Ingredient yet, and is priced once the server has resolved it.
    if (ingredientId && was && product !== undefined) {
      const link: ResolvedProductLink = {
        storeId,
        ingredientId,
        triedAt: new Date(),
        product,
        suggestion: null,
      };
      const mine = (l: ResolvedProductLink) =>
        l.storeId === storeId && l.ingredientId === ingredientId;

      queryClient.setQueryData(pricesKey, [...was.filter((l) => !mine(l)), link]);
    }
    const input = { storeId, name, choice };

    if (was) pricesBefore.set(input, was);
    mutate(input);
  };
}
