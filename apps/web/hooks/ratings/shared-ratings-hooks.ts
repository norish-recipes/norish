"use client";

import { createRatingsHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedRatingsHooks = createRatingsHooks({ useTRPC });
