"use client";

import { useMutation } from "@tanstack/react-query";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";

import { useTRPC } from "../trpc";
import { useHousehold, useHouseholdCacheHelpers } from "./household";
import { useReader } from "./identity";

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
  const { household, currentUserId } = useHousehold();
  const { setHouseholdData, invalidate } = useHouseholdCacheHelpers();
  const userName = useReader().user?.name ?? null;

  const getHouseholdVersion = (householdId: string): number =>
    household?.id === householdId ? household.version : 1;
  const memberVersion = (householdId: string, userId: string | undefined): number =>
    household?.id === householdId
      ? (household.users.find((user) => user.id === userId)?.version ?? 1)
      : 1;
  const onError = () => invalidate();

  const { mutate: mutateCreate } = useMutation(
    trpc.households.create.mutationOptions({
      onSuccess: ({ id }, { name }) => {
        if (!currentUserId) return;

        const created: HouseholdSettingsDto = {
          id,
          name: name ?? "",
          version: 1,
          users: [{ id: currentUserId, name: userName, isAdmin: true, version: 1 }],
          allergies: [],
        };

        setHouseholdData((prev) => ({
          household: created,
          currentUserId: prev?.currentUserId ?? currentUserId,
        }));
      },
      onError,
    })
  );
  // The joined household arrives through the subscription.
  const { mutate: mutateJoin } = useMutation(trpc.households.join.mutationOptions({ onError }));
  const { mutate: mutateLeave } = useMutation(
    trpc.households.leave.mutationOptions({
      onSuccess: () => {
        setHouseholdData((prev) => ({
          household: null,
          currentUserId: prev?.currentUserId ?? currentUserId ?? "",
        }));
      },
      onError,
    })
  );
  const { mutate: mutateKick } = useMutation(
    trpc.households.kick.mutationOptions({
      onSuccess: (_data, { userId }) => {
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
      onError,
    })
  );
  // The new join code arrives through the subscription.
  const { mutate: mutateRegenerateCode } = useMutation(
    trpc.households.regenerateCode.mutationOptions({ onError })
  );
  const { mutate: mutateTransferAdmin } = useMutation(
    trpc.households.transferAdmin.mutationOptions({
      onSuccess: (_data, { newAdminId }) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          // The Reader is no longer admin, so the household drops to the member view.
          const updated: HouseholdSettingsDto = {
            id: prev.household.id,
            name: prev.household.name,
            version: prev.household.version,
            users: prev.household.users.map((u) => ({ ...u, isAdmin: u.id === newAdminId })),
            allergies: prev.household.allergies,
          };

          return { ...prev, household: updated };
        });
      },
      onError,
    })
  );

  const createHousehold = (name: string): void => {
    if (!name.trim()) {
      throw new Error("Household name cannot be empty");
    }

    if (!currentUserId) {
      throw new Error("User ID not available");
    }

    mutateCreate({ name: name.trim() });
  };

  const joinHousehold = (code: string): void => {
    if (!code.trim()) {
      throw new Error("Join code cannot be empty");
    }

    if (!currentUserId) {
      throw new Error("User ID not available");
    }

    mutateJoin({ code: code.trim() });
  };

  const leaveHousehold = (householdId: string): void => {
    mutateLeave({ householdId, version: memberVersion(householdId, currentUserId) });
  };

  const kickUser = (householdId: string, userId: string): void => {
    mutateKick({ householdId, userId, version: memberVersion(householdId, userId) });
  };

  const regenerateJoinCode = (householdId: string): void => {
    mutateRegenerateCode({ householdId, version: getHouseholdVersion(householdId) });
  };

  const transferAdmin = (householdId: string, newAdminId: string): void => {
    mutateTransferAdmin({ householdId, newAdminId, version: getHouseholdVersion(householdId) });
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
