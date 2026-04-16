"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createAdminHooks } from "@norish/shared-react/hooks";

export const sharedAdminHooks = createAdminHooks({ useTRPC });
