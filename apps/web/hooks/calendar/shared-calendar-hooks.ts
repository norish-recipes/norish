"use client";

import { createCalendarHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedCalendarHooks = createCalendarHooks({ useTRPC });
