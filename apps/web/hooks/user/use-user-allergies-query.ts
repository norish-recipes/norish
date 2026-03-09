"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createUserHooks } from "@norish/shared-react/hooks";

const sharedUserHooks = createUserHooks({ useTRPC });

export const useUserAllergiesQuery = sharedUserHooks.useUserAllergiesQuery;
