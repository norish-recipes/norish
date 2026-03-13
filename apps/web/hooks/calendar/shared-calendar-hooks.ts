"use client";

import { createCalendarHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


export const sharedCalendarHooks = createCalendarHooks({ useTRPC });
