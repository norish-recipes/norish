import { useMutation } from "@tanstack/react-query";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";

import type {
  CreateHouseholdHooksOptions,
  HouseholdMutationsResult,
  HouseholdQueryResult,
} from "./types";

type CreateUseHouseholdMutationsOptions = CreateHouseholdHooksOptions & {
  useHouseholdQuery: () => HouseholdQueryResult;
  useCurrentUserName: () => string | null;
};

export function createUseHouseholdMutations({
  useTRPC,
  useHouseholdQuery,
  useCurrentUserName,
}: CreateUseHouseholdMutationsOptions) {
  return function useHouseholdMutations(): HouseholdMutationsResult {
    const trpc = useTRPC();
    const { household, setHouseholdData, invalidate, currentUserId } = useHouseholdQuery();
    const userName = useCurrentUserName();

    const getHouseholdVersion = (householdId: string): number =>
      household?.id === householdId ? household.version : 1;

    const createMutation = useMutation(trpc.households.create.mutationOptions());
    const joinMutation = useMutation(trpc.households.join.mutationOptions());
    const leaveMutation = useMutation(trpc.households.leave.mutationOptions());
    const kickMutation = useMutation(trpc.households.kick.mutationOptions());
    const regenerateCodeMutation = useMutation(trpc.households.regenerateCode.mutationOptions());
    const transferAdminMutation = useMutation(trpc.households.transferAdmin.mutationOptions());

    const createHousehold = (name: string): void => {
      if (!name.trim()) {
        throw new Error("Household name cannot be empty");
      }

      if (!currentUserId) {
        throw new Error("User ID not available");
      }

      createMutation.mutate(
        { name: name.trim() },
        {
          onSuccess: ({ id }) => {
            // Optimistically add the household
            const optimisticHousehold: HouseholdSettingsDto = {
              id,
              name: name.trim(),
              version: 1,
              users: [
                {
                  id: currentUserId,
                  name: userName,
                  isAdmin: true,
                  version: 1,
                },
              ],
              allergies: [],
            };

            setHouseholdData((prev) => ({
              household: optimisticHousehold,
              currentUserId: prev?.currentUserId ?? currentUserId,
            }));
          },
          onError: () => invalidate(),
        }
      );
    };

    const joinHousehold = (code: string): void => {
      if (!code.trim()) {
        throw new Error("Join code cannot be empty");
      }

      if (!currentUserId) {
        throw new Error("User ID not available");
      }

      joinMutation.mutate(
        { code: code.trim() },
        {
          // Optimistic update will come from the subscription (onCreated)
          onError: () => invalidate(),
        }
      );
    };

    const leaveHousehold = (householdId: string): void => {
      const currentMembershipVersion =
        household?.id === householdId
          ? (household.users.find((user) => user.id === currentUserId)?.version ?? 1)
          : 1;

      leaveMutation.mutate(
        { householdId, version: currentMembershipVersion },
        {
          onSuccess: () => {
            // Clear household from cache
            setHouseholdData((prev) => ({
              household: null,
              currentUserId: prev?.currentUserId ?? currentUserId ?? "",
            }));
          },
          onError: () => invalidate(),
        }
      );
    };

    const kickUser = (householdId: string, userId: string): void => {
      const memberVersion =
        household?.id === householdId
          ? (household.users.find((user) => user.id === userId)?.version ?? 1)
          : 1;

      kickMutation.mutate(
        { householdId, userId, version: memberVersion },
        {
          onSuccess: () => {
            // Optimistically remove the user from the list
            setHouseholdData((prev) => {
              if (!prev?.household) return prev;

              return {
                ...prev,
                household: {
                  ...prev.household,
                  users: prev.household.users.filter((u) => u.id !== userId),
                },
              };
            });
          },
          onError: () => invalidate(),
        }
      );
    };

    const regenerateJoinCode = (householdId: string): void => {
      regenerateCodeMutation.mutate(
        { householdId, version: getHouseholdVersion(householdId) },
        {
          // The new join code will come from the subscription
          onError: () => invalidate(),
        }
      );
    };

    const transferAdmin = (householdId: string, newAdminId: string): void => {
      transferAdminMutation.mutate(
        { householdId, newAdminId, version: getHouseholdVersion(householdId) },
        {
          onSuccess: () => {
            // Optimistically update admin status
            setHouseholdData((prev) => {
              if (!prev?.household) return prev;

              // After transferring admin, current user is no longer admin
              // So we need to update the household to non-admin view
              const updatedHousehold: HouseholdSettingsDto = {
                id: prev.household.id,
                name: prev.household.name,
                version: prev.household.version,
                users: prev.household.users.map((u) => ({
                  ...u,
                  isAdmin: u.id === newAdminId,
                })),
                allergies: prev.household.allergies,
              };

              return {
                ...prev,
                household: updatedHousehold,
              };
            });
          },
          onError: () => invalidate(),
        }
      );
    };

    return {
      createHousehold,
      joinHousehold,
      leaveHousehold,
      kickUser,
      regenerateJoinCode,
      transferAdmin,
    };
  };
}
