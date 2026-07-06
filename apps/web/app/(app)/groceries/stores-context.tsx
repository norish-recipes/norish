"use client";

import { useStoresMutations, useStoresQuery, useStoresSubscription } from "@/hooks/stores";

import { createStoresContext } from "@norish/shared-react/contexts";

const sharedStoresContext = createStoresContext({
  useStoresQuery,
  useStoresMutations,
  useStoresSubscription,
});

export const StoresContextProvider = sharedStoresContext.StoresContextProvider;
export const useStoresContext = sharedStoresContext.useStoresContext;
