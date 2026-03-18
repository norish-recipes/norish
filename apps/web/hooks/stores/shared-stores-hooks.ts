"use client";

import { createStoresHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedStoresHooks = createStoresHooks({ useTRPC });
