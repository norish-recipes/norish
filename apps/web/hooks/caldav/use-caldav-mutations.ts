"use client";

import { sharedCaldavHooks } from "./shared-caldav-hooks";

export const useCaldavMutations = sharedCaldavHooks.useCaldavMutations;

export type {
  CaldavMutationsResult,
  FetchCalendarsInput,
  SaveCaldavConfigInput,
  TestConnectionInput,
} from "@norish/shared-react/hooks";
