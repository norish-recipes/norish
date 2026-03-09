"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createRatingsHooks } from "@norish/shared-react/hooks";

export const sharedRatingsHooks = createRatingsHooks({ useTRPC });
