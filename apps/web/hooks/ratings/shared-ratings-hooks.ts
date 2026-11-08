"use client";

import { createRatingsHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedRatingsHooks = createRatingsHooks({ useTRPC });
