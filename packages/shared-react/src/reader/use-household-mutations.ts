"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";

import { useTRPC } from "../trpc";
import { useHousehold, useHouseholdCacheHelpers } from "./use-household";
import { useReader } from "./use-reader";

type HouseholdMutationsResult = {
  createHousehold: (name: string) => void;
  joinHousehold: (code: string) => void;
  leaveHousehold: (householdId: string) => void;
  kickUser: (householdId: string, userId: string) => void;
  regenerateJoinCode: (householdId: string) => void;
  transferAdmin: (householdId: string, newAdminId: string) => void;
  /** Whether each action's request is in flight; a call while it is is dropped. */
  pending: Record<Action, boolean>;
};

type Action = "create" | "join" | "leave" | "kick" | "regenerate" | "transfer";

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
  // Claimed synchronously, so a repeat before React re-renders is dropped; settling frees it.
  const inFlight = useRef(new Set<string>());
  const claim = (action: string) => {
    if (inFlight.current.has(action)) return null;
    inFlight.current.add(action);

    return { onSettled: () => inFlight.current.delete(action) };
  };

  const { mutate: mutateCreate, isPending: isCreating } = useMutation(
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
  const { mutate: mutateJoin, isPending: isJoining } = useMutation(
    trpc.households.join.mutationOptions({ onError })
  );
  const { mutate: mutateLeave, isPending: isLeaving } = useMutation(
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
  const { mutate: mutateKick, isPending: isKicking } = useMutation(
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
  const { mutate: mutateRegenerateCode, isPending: isRegenerating } = useMutation(
    trpc.households.regenerateCode.mutationOptions({ onError })
  );
  const { mutate: mutateTransferAdmin, isPending: isTransferring } = useMutation(
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

    const settle = claim("create");

    if (settle) mutateCreate({ name: name.trim() }, settle);
  };

  const joinHousehold = (code: string): void => {
    if (!code.trim()) {
      throw new Error("Join code cannot be empty");
    }

    if (!currentUserId) {
      throw new Error("User ID not available");
    }

    const settle = claim("join");

    if (settle) mutateJoin({ code: code.trim() }, settle);
  };

  const leaveHousehold = (householdId: string): void => {
    const settle = claim("leave");

    if (settle) {
      mutateLeave({ householdId, version: memberVersion(householdId, currentUserId) }, settle);
    }
  };

  const kickUser = (householdId: string, userId: string): void => {
    const settle = claim(`kick:${userId}`);

    if (settle)
      mutateKick({ householdId, userId, version: memberVersion(householdId, userId) }, settle);
  };

  const regenerateJoinCode = (householdId: string): void => {
    const settle = claim("regenerate");

    if (settle) {
      mutateRegenerateCode({ householdId, version: getHouseholdVersion(householdId) }, settle);
    }
  };

  const transferAdmin = (householdId: string, newAdminId: string): void => {
    const settle = claim("transfer");

    if (settle) {
      mutateTransferAdmin(
        { householdId, newAdminId, version: getHouseholdVersion(householdId) },
        settle
      );
    }
  };

  return {
    createHousehold,
    joinHousehold,
    leaveHousehold,
    kickUser,
    regenerateJoinCode,
    transferAdmin,
    pending: {
      create: isCreating,
      join: isJoining,
      leave: isLeaving,
      kick: isKicking,
      regenerate: isRegenerating,
      transfer: isTransferring,
    },
  };
}
