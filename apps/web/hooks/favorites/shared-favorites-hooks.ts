"use client";

import { createFavoritesHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedFavoritesHooks = createFavoritesHooks({ useTRPC });
