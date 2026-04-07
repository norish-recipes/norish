import { useHouseholdQuery, useHouseholdSubscription } from "@/hooks/households";

import { createHouseholdContext } from "@norish/shared-react/contexts";

export type { HouseholdContextValue } from "@norish/shared-react/contexts";

const { HouseholdProvider, useHouseholdContext } = createHouseholdContext({
  useHouseholdQuery,
  useHouseholdSubscription,
});

export { HouseholdProvider, useHouseholdContext };
