"use client";

import { createAdminHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedAdminHooks = createAdminHooks({ useTRPC });
