"use client";

import { createStoresHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedStoresHooks = createStoresHooks({ useTRPC });
