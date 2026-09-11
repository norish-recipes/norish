"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createPantryHooks } from "@norish/shared-react/hooks";

export const sharedPantryHooks = createPantryHooks({ useTRPC });
