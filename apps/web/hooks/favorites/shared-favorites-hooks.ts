"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createFavoritesHooks } from "@norish/shared-react/hooks";

export const sharedFavoritesHooks = createFavoritesHooks({ useTRPC });
