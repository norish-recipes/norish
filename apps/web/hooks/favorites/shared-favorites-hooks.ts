"use client";

import { createFavoritesHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedFavoritesHooks = createFavoritesHooks({ useTRPC });
