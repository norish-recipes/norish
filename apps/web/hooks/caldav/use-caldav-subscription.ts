"use client";

import { sharedCaldavHooks } from "./shared-caldav-hooks";

export const useCaldavSubscription = sharedCaldavHooks.useCaldavSubscription;
export const useCaldavItemStatusSubscription = sharedCaldavHooks.useCaldavItemStatusSubscription;
export const useCaldavSyncCompleteSubscription =
  sharedCaldavHooks.useCaldavSyncCompleteSubscription;
