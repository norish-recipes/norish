"use client";

import { createPermissionsHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedPermissionsHooks = createPermissionsHooks({ useTRPC });
