"use client";

import { useHouseholdContext } from "@/context/household-context";

import type { UseActiveAllergiesResult } from "@norish/shared-react/hooks";
import { createUseActiveAllergies } from "@norish/shared-react/hooks";

import { useUserAllergiesQuery } from "./use-user-allergies-query";

export const useActiveAllergies = createUseActiveAllergies({
  useHouseholdContext,
  useUserAllergiesQuery,
});

export type { UseActiveAllergiesResult };
