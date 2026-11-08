"use client";

import { createUserHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

const sharedUserHooks = createUserHooks({ useTRPC });

export const useUserAllergiesQuery = sharedUserHooks.useUserAllergiesQuery;
