"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createPermissionsHooks } from "@norish/shared-react/hooks";

export const sharedPermissionsHooks = createPermissionsHooks({ useTRPC });
