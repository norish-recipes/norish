"use client";

import { useMutation } from "@tanstack/react-query";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";

import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { useHousehold, useHouseholdCacheHelpers } from "./use-household";

/** Each action resolves whether its request went through: false when it failed. */
type HouseholdMutationsResult = {
  joinHousehold: (code: string) => Promise<boolean>;
  leaveHousehold: (householdId: string) => Promise<boolean>;
  kickUser: (householdId: string, userId: string) => Promise<boolean>;
  regenerateJoinCode: (householdId: string) => Promise<boolean>;
  transferAdmin: (householdId: string, newAdminId: string) => Promise<boolean>;
  /** Whether each action's request is in flight, for a caller that must not send it twice. */
  pending: Record<"join" | "leave" | "kick" | "regenerate" | "transfer", boolean>;
};

export function useHouseholdMutations(): HouseholdMutationsResult {
  const trpc = useTRPC();
  const { household, currentUserId } = useHousehold();
  const { setHouseholdData, invalidate } = useHouseholdCacheHelpers();
  const { showError } = usePlatform();

  const getHouseholdVersion = (householdId: string): number =>
    household?.id === householdId ? household.version : 1;
  const memberVersion = (householdId: string, userId: string | undefined): number =>
    household?.id === householdId
      ? (household.users.find((user) => user.id === userId)?.version ?? 1)
      : 1;
  // A failed action rereads the household and tells the reader why, with the server's reason.
  const onError = (action: string) => (error: unknown) => {
    void invalidate();
    showError(error, `household:${action}`);
  };

  // The joined household arrives through the subscription.
  const { mutateAsync: mutateJoin, isPending: isJoining } = useMutation(
    trpc.households.join.mutationOptions({ onError: onError("join") })
  );
  // The new household of one arrives through the subscription.
  const { mutateAsync: mutateLeave, isPending: isLeaving } = useMutation(
    trpc.households.leave.mutationOptions({ onError: onError("leave") })
  );
  const { mutateAsync: mutateKick, isPending: isKicking } = useMutation(
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
      onError: onError("kick"),
    })
  );
  // The new join code arrives through the subscription.
  const { mutateAsync: mutateRegenerateCode, isPending: isRegenerating } = useMutation(
    trpc.households.regenerateCode.mutationOptions({ onError: onError("regenerate") })
  );
  const { mutateAsync: mutateTransferAdmin, isPending: isTransferring } = useMutation(
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
      onError: onError("transfer"),
    })
  );

  const joinHousehold = (code: string): Promise<boolean> => {
    if (!code.trim()) {
      throw new Error("Join code cannot be empty");
    }

    if (!currentUserId) {
      throw new Error("User ID not available");
    }

    return wentThrough(mutateJoin({ code: code.trim() }));
  };

  const leaveHousehold = (householdId: string): Promise<boolean> => {
    return wentThrough(
      mutateLeave({ householdId, version: memberVersion(householdId, currentUserId) })
    );
  };

  const kickUser = (householdId: string, userId: string): Promise<boolean> => {
    return wentThrough(
      mutateKick({ householdId, userId, version: memberVersion(householdId, userId) })
    );
  };

  const regenerateJoinCode = (householdId: string): Promise<boolean> => {
    return wentThrough(
      mutateRegenerateCode({ householdId, version: getHouseholdVersion(householdId) })
    );
  };

  const transferAdmin = (householdId: string, newAdminId: string): Promise<boolean> => {
    return wentThrough(
      mutateTransferAdmin({ householdId, newAdminId, version: getHouseholdVersion(householdId) })
    );
  };

  return {
    joinHousehold,
    leaveHousehold,
    kickUser,
    regenerateJoinCode,
    transferAdmin,
    pending: {
      join: isJoining,
      leave: isLeaving,
      kick: isKicking,
      regenerate: isRegenerating,
      transfer: isTransferring,
    },
  };
}
