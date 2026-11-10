"use client";

import { createCookbookHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedCookbookHooks = createCookbookHooks({ useTRPC });
