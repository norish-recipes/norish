"use client";

import type { HouseholdSettingsDto } from "@/types/dto/household";

import { useMutation } from "@tanstack/react-query";

import { useHouseholdQuery } from "./use-household-query";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";

export type HouseholdMutationsResult = {
  createHousehold: (name: string) => void;
  joinHousehold: (code: string) => void;
  leaveHousehold: (householdId: string) => void;
  kickUser: (householdId: string, userId: string) => void;
  regenerateJoinCode: (householdId: string) => void;
  transferAdmin: (householdId: string, newAdminId: string) => void;
};

export function useHouseholdMutations(): HouseholdMutationsResult {
  const trpc = useTRPC();
  const { setHouseholdData, invalidate, currentUserId } = useHouseholdQuery();
  const { user } = useUserContext();

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
            users: [
              {
                id: currentUserId,
                name: user?.name ?? null,
                isAdmin: true,
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
    leaveMutation.mutate(
      { householdId },
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
    kickMutation.mutate(
      { householdId, userId },
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
      { householdId },
      {
        // The new join code will come from the subscription
        onError: () => invalidate(),
      }
    );
  };

  const transferAdmin = (householdId: string, newAdminId: string): void => {
    transferAdminMutation.mutate(
      { householdId, newAdminId },
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
}
