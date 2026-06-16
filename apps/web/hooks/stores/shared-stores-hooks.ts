"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createStoresHooks } from "@norish/shared-react/hooks";

export const sharedStoresHooks = createStoresHooks({ useTRPC });
