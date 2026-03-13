"use client";

import { createConfigHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedConfigHooks = createConfigHooks({ useTRPC });
