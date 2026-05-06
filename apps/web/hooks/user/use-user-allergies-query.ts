"use client";

import { createUserHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


const sharedUserHooks = createUserHooks({ useTRPC });

export const useUserAllergiesQuery = sharedUserHooks.useUserAllergiesQuery;
