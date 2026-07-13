import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";
import { generateOperationId } from "@norish/shared/lib/operation-helpers";
import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";

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
    const queryClient = useQueryClient();
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
        { id: generateOperationId(), name: name.trim() },
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
          onError: (error) => {
            if (!isQueuedDeliveryError(error)) invalidate();
          },
        }
      );
    };

    const joinHousehold = (code: string, householdId?: string): Promise<void> => {
      if (!code.trim()) {
        throw new Error("Join code cannot be empty");
      }

      if (!currentUserId) {
        throw new Error("User ID not available");
      }

      return (async () => {
        let resolvedHouseholdId = householdId;

        if (!resolvedHouseholdId) {
          try {
            const resolved = await queryClient.fetchQuery(
              trpc.households.resolveJoinCode.queryOptions({ code: code.trim() })
            );

            resolvedHouseholdId = resolved.householdId;
          } catch (error) {
            if (!isQueuedDeliveryError(error)) invalidate();

            return;
          }
        }

        joinMutation.mutate(
          { code: code.trim(), householdId: resolvedHouseholdId },
          {
            // Optimistic update will come from the subscription (onCreated)
            onError: (error) => {
              if (!isQueuedDeliveryError(error)) invalidate();
            },
          }
        );
      })();
    };

    const leaveHousehold = (householdId: string): void => {
      const currentMembershipVersion =
        household?.id === householdId
          ? (household.users.find((user) => user.id === currentUserId)?.version ?? 1)
          : 1;

      leaveMutation.mutate(
        { householdId, version: currentMembershipVersion },
        {
          onSuccess: (result) => {
            if (result.stale) {
              invalidate();

              return;
            }

            // Clear household from cache
            setHouseholdData((prev) => ({
              household: null,
              currentUserId: prev?.currentUserId ?? currentUserId ?? "",
            }));
          },
          onError: (error) => {
            if (!isQueuedDeliveryError(error)) invalidate();
          },
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
          onSuccess: (result) => {
            if (result.stale) {
              invalidate();

              return;
            }

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
          onError: (error) => {
            if (!isQueuedDeliveryError(error)) invalidate();
          },
        }
      );
    };

    const regenerateJoinCode = (householdId: string): void => {
      regenerateCodeMutation.mutate(
        { householdId, version: getHouseholdVersion(householdId) },
        {
          onSuccess: (result) => {
            if (result.stale) {
              invalidate();
            }
          },
          // The new join code will come from the subscription
          onError: (error) => {
            if (!isQueuedDeliveryError(error)) invalidate();
          },
        }
      );
    };

    const transferAdmin = (householdId: string, newAdminId: string): void => {
      transferAdminMutation.mutate(
        { householdId, newAdminId, version: getHouseholdVersion(householdId) },
        {
          onSuccess: (result) => {
            if (result.stale) {
              invalidate();

              return;
            }

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
          onError: (error) => {
            if (!isQueuedDeliveryError(error)) invalidate();
          },
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
