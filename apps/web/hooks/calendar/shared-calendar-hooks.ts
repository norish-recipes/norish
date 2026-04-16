"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createCalendarHooks } from "@norish/shared-react/hooks";

export const sharedCalendarHooks = createCalendarHooks({ useTRPC });
