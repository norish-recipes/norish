"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createConfigHooks } from "@norish/shared-react/hooks";

export const sharedConfigHooks = createConfigHooks({ useTRPC });
