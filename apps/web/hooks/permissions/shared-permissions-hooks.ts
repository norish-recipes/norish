"use client";

import { createPermissionsHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedPermissionsHooks = createPermissionsHooks({ useTRPC });
