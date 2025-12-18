"use client";

import type { HouseholdAdminSettingsDto } from "@/types/dto/household";

import { useSubscription } from "@trpc/tanstack-react-query";
import { useQueryClient } from "@tanstack/react-query";
import { addToast } from "@heroui/react";

import { useHouseholdQuery } from "./use-household-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook that subscribes to all household-related WebSocket events
 */
export function useHouseholdSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setHouseholdData, invalidate, currentUserId } = useHouseholdQuery();

  // onCreated user-scoped: when current user creates or joins a household
  useSubscription(
    trpc.households.onCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => ({
          household: payload.household,
          currentUserId: prev?.currentUserId ?? currentUserId ?? "",
        }));
      },
    })
  );

  // onKicked user-scoped: when current user is kicked
  useSubscription(
    trpc.households.onKicked.subscriptionOptions(undefined, {
      onData: () => {
        addToast({
          title: "Removed from household",
          description: "You have been removed from the household by an admin.",
          color: "warning",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });

        // Clear household from cache
        setHouseholdData((prev) => ({
          household: null,
          currentUserId: prev?.currentUserId ?? currentUserId ?? "",
        }));
      },
    })
  );

  // onFailed user-scoped: error notifications
  useSubscription(
    trpc.households.onFailed.subscriptionOptions(undefined, {
      onData: (payload) => {
        addToast({
          title: "Household Error",
          description: payload.reason,
          color: "danger",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        invalidate();
      },
    })
  );

  // onUserJoined household-scoped: when another user joins
  useSubscription(
    trpc.households.onUserJoined.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          // Check if user already exists (shouldn't happen, but be safe)
          const userExists = prev.household.users.some((u) => u.id === payload.user.id);

          if (userExists) return prev;

          return {
            ...prev,
            household: {
              ...prev.household,
              users: [
                ...prev.household.users,
                {
                  id: payload.user.id,
                  name: payload.user.name,
                  isAdmin: payload.user.isAdmin,
                },
              ],
            },
          };
        });
      },
    })
  );

  // onUserLeft user-scoped: when another user leaves
  useSubscription(
    trpc.households.onUserLeft.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          return {
            ...prev,
            household: {
              ...prev.household,
              users: prev.household.users.filter((u) => u.id !== payload.userId),
            },
          };
        });
      },
    })
  );

  // onMemberRemoved household-scoped: when a member is kicked (for remaining members)
  useSubscription(
    trpc.households.onMemberRemoved.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          return {
            ...prev,
            household: {
              ...prev.household,
              users: prev.household.users.filter((u) => u.id !== payload.userId),
            },
          };
        });
      },
    })
  );

  // onAdminTransferred household-scoped: when admin is transferred
  useSubscription(
    trpc.households.onAdminTransferred.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          const isCurrentUserNewAdmin = payload.newAdminId === prev.currentUserId;

          // If current user became admin, we need to refetch to get joinCode
          if (isCurrentUserNewAdmin) {
            invalidate();

            return prev;
          }

          // If current user was admin and lost it, update to non-admin view
          // (remove joinCode fields if they exist)
          const updatedUsers = prev.household.users.map((u) => ({
            ...u,
            isAdmin: u.id === payload.newAdminId,
          }));

          return {
            ...prev,
            household: {
              id: prev.household.id,
              name: prev.household.name,
              users: updatedUsers,
              allergies: prev.household.allergies,
            },
          };
        });
      },
    })
  );

  // onJoinCodeRegenerated household-scoped: when join code is regenerated
  useSubscription(
    trpc.households.onJoinCodeRegenerated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          // Only update if this is an admin view (has joinCode field)
          const adminHousehold = prev.household as HouseholdAdminSettingsDto;

          if (!("joinCode" in adminHousehold)) {
            // Non-admin user, nothing to update
            return prev;
          }

          return {
            ...prev,
            household: {
              ...prev.household,
              joinCode: payload.joinCode,
              joinCodeExpiresAt: new Date(payload.joinCodeExpiresAt),
            },
          };
        });
      },
    })
  );

  useSubscription(
    trpc.households.onAllergiesUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setHouseholdData((prev) => {
          if (!prev?.household) return prev;

          return {
            ...prev,
            household: {
              ...prev.household,
              allergies: payload.allergies,
            },
          };
        });

        // Invalidate calendar to recompute allergy warnings
        queryClient.invalidateQueries({ queryKey: [["calendar", "listRecipes"]] });
      },
    })
  );
}
