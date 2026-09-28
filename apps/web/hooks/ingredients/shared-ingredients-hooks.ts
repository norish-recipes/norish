"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createIngredientsHooks } from "@norish/shared-react/hooks";

export const sharedIngredientsHooks = createIngredientsHooks({ useTRPC });
