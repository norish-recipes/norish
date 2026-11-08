"use client";

import { createAdminHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedAdminHooks = createAdminHooks({ useTRPC });
