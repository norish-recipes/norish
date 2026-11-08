"use client";

import { createPantryHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedPantryHooks = createPantryHooks({ useTRPC });
