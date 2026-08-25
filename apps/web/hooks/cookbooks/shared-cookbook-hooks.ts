"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createCookbookHooks } from "@norish/shared-react/hooks";

export const sharedCookbookHooks = createCookbookHooks({ useTRPC });
